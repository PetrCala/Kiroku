import type {ReactNode} from 'react';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {AppState} from 'react-native';
import type {NetInfoState} from '@react-native-community/netinfo';
import NetInfo from '@react-native-community/netinfo';
import isBoolean from 'lodash/isBoolean';
import type {ValueOf} from 'type-fest';
import * as NetworkActions from '@userActions/Network';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';

type UserConnectionContextProps = {
  isOnline: boolean | undefined;
};

type Connectivity = {
  /** Whether the device should be treated as offline. */
  isOffline: boolean;

  /**
   * Whether NetInfo has actually resolved connectivity. On an iOS cold start
   * the first state can carry `isConnected: null` ("not determined yet");
   * callers must keep rechecking until this is true, because if the OS state
   * never changes afterwards (e.g. the app was launched already in airplane
   * mode) NetInfo emits no further events and the app would stay latched on
   * whatever this first guess was.
   */
  isDetermined: boolean;

  /** The NETWORK.networkStatus value this state maps to. */
  networkStatus: ValueOf<typeof CONST.NETWORK.NETWORK_STATUS>;
};

/**
 * Map a NetInfo state to the app's connectivity model. Offline means the OS
 * reports either no network interface (`isConnected === false`) or a network
 * without internet access (`isInternetReachable === false`, e.g. a captive
 * portal or a dead wifi). `null`/`undefined` fields mean "not determined yet"
 * and must count as neither online nor offline. Emulator/local dev is pinned
 * online so the request queue keeps flushing.
 */
function deriveConnectivity(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
  isUsingEmulators: boolean,
): Connectivity {
  if (isUsingEmulators) {
    return {
      isOffline: false,
      isDetermined: true,
      networkStatus: CONST.NETWORK.NETWORK_STATUS.ONLINE,
    };
  }
  const isOffline =
    state.isConnected === false || state.isInternetReachable === false;
  const isDetermined =
    isBoolean(state.isConnected) || isBoolean(state.isInternetReachable);
  let networkStatus;
  if (!isDetermined) {
    networkStatus = CONST.NETWORK.NETWORK_STATUS.UNKNOWN;
  } else {
    networkStatus = isOffline
      ? CONST.NETWORK.NETWORK_STATUS.OFFLINE
      : CONST.NETWORK.NETWORK_STATUS.ONLINE;
  }
  return {isOffline, isDetermined, networkStatus};
}

// How long to wait between NetInfo rechecks while the state is still
// undetermined, and how many times to try before settling for UNKNOWN (later
// NetInfo events and app-foreground rechecks can still resolve it).
const UNDETERMINED_RECHECK_DELAY_MS = 2000;
const UNDETERMINED_RECHECK_MAX_ATTEMPTS = 5;

const UserConnectionContext = createContext<
  UserConnectionContextProps | undefined
>(undefined);

/** Fetch the useConnection context. If the context does not exist, throw an error.
 *
 * @example { isOnline } = useUserConnection(); // Returns a boolean
 */
const useUserConnection = (): UserConnectionContextProps => {
  const context = useContext(UserConnectionContext);
  if (!context) {
    throw new Error(
      'useUserConnection must be used within a UserConnectionProvider',
    );
  }
  return context;
};

type UserConnectionProviderProps = {
  children: ReactNode;
};

/** Provide a user connection context to the application
 *
 * Using a user connection listener, monitor the user connection status
 * and provide this information through a context provider.
 */
function UserConnectionProvider({children}: UserConnectionProviderProps) {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(true);

  useEffect(() => {
    // Treat emulator/local dev as always online so the request queue keeps
    // flushing and dev builds aren't pinned offline.
    const isUsingEmulators = CONFIG.IS_USING_EMULATORS;

    let recheckTimer: ReturnType<typeof setTimeout> | null = null;
    let recheckAttempts = 0;
    let lastIsOffline: boolean | null = null;
    let isUnmounted = false;

    // Mirror device connectivity into both the local context value (drives the
    // OfflineIndicator/UX) and the NETWORK Onyx key. The latter is what
    // NetworkStore.isOffline() and useNetwork() read, so populating it here is
    // what lets the request queue defer writes while offline and replay them on
    // reconnect. This is the single writer of the NETWORK key's connectivity
    // fields while NetworkConnection.subscribeToNetInfo() stays disabled.
    const applyConnectivity = (state: NetInfoState, reason: string) => {
      if (isUnmounted) {
        return;
      }
      const {isOffline, isDetermined, networkStatus} = deriveConnectivity(
        state,
        isUsingEmulators,
      );
      setIsOnline(!isOffline);
      // Log only transitions so routine NetInfo chatter stays quiet but an
      // offline flip is always traceable on-device.
      NetworkActions.setIsOffline(
        isOffline,
        lastIsOffline === isOffline ? '' : reason,
      );
      lastIsOffline = isOffline;
      NetworkActions.setNetWorkStatus(networkStatus);

      // An undetermined state must not latch: if the OS never emits another
      // event (it won't when the app was launched with connectivity already in
      // its final state, e.g. cold-started in airplane mode), the app would
      // stay pinned on the boot-time guess. Recheck until NetInfo resolves.
      if (isDetermined) {
        recheckAttempts = 0;
        if (recheckTimer) {
          clearTimeout(recheckTimer);
          recheckTimer = null;
        }
        return;
      }
      if (
        recheckTimer ||
        recheckAttempts >= UNDETERMINED_RECHECK_MAX_ATTEMPTS
      ) {
        return;
      }
      recheckAttempts += 1;
      recheckTimer = setTimeout(() => {
        recheckTimer = null;
        NetInfo.refresh().then(freshState => {
          applyConnectivity(freshState, 'NetInfo recheck (undetermined state)');
        });
      }, UNDETERMINED_RECHECK_DELAY_MS);
    };

    // Subscribe to network state updates
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      applyConnectivity(state, 'NetInfo state change event');
    });

    // Check the initial network status
    NetInfo.fetch().then(state => {
      applyConnectivity(state, 'NetInfo initial fetch');
    });

    // Re-evaluate on every return to the foreground: while backgrounded the
    // app can miss NetInfo events, and a state that "changed while we were not
    // looking" otherwise goes unnoticed until the next OS-level transition.
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (nextAppState !== 'active') {
          return;
        }
        NetInfo.refresh().then(state => {
          applyConnectivity(state, 'NetInfo recheck (app foregrounded)');
        });
      },
    );

    return () => {
      isUnmounted = true;
      if (recheckTimer) {
        clearTimeout(recheckTimer);
      }
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, []);

  const value = useMemo(() => {
    return {isOnline};
  }, [isOnline]);

  return (
    <UserConnectionContext.Provider value={value}>
      {children}
    </UserConnectionContext.Provider>
  );
}

export {
  UserConnectionContext,
  useUserConnection,
  UserConnectionProvider,
  deriveConnectivity,
};
export type {UserConnectionContextProps};
