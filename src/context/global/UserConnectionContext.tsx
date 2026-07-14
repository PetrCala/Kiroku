import type {ReactNode} from 'react';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {AppState} from 'react-native';
import type {NetInfoState} from '@react-native-community/netinfo';
import NetInfo from '@react-native-community/netinfo';
import isBoolean from 'lodash/isBoolean';
import type {ValueOf} from 'type-fest';
import * as ApiUtils from '@libs/ApiUtils';
import {KIROKU_DIRECT_PATHS} from '@libs/API/kirokuRoutes';
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
   * Whether connectivity has actually been resolved. On an iOS cold start the
   * first NetInfo state can carry `isConnected: null` ("not determined yet");
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
 * Map a NetInfo state (plus the app's own end-to-end API probe result) to the
 * app's connectivity model. Offline means any of: the OS reports no network
 * interface (`isConnected === false`), the OS reports a network without
 * internet access (`isInternetReachable === false`, e.g. a captive portal or
 * dead wifi), or the app's own reachability probe proved the API unreachable
 * (`isApiReachable === false`). The probe input exists because the OS signals
 * alone are not sufficient: a VPN tunnel with no internet behind it keeps
 * utun interfaces up even in airplane mode, so iOS reports the path as
 * satisfied and every request black-holes to its full timeout.
 * `null`/`undefined` inputs mean "not determined yet" and count as neither
 * online nor offline. Emulator/local dev is pinned online so the request
 * queue keeps flushing.
 */
function deriveConnectivity(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
  isUsingEmulators: boolean,
  isApiReachable: boolean | null = null,
): Connectivity {
  if (isUsingEmulators) {
    return {
      isOffline: false,
      isDetermined: true,
      networkStatus: CONST.NETWORK.NETWORK_STATUS.ONLINE,
    };
  }
  const isOffline =
    state.isConnected === false ||
    state.isInternetReachable === false ||
    isApiReachable === false;
  const isDetermined =
    isBoolean(state.isConnected) ||
    isBoolean(state.isInternetReachable) ||
    isBoolean(isApiReachable);
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

// Probe cadence: while the last probe succeeded, re-verify on a slow cycle
// (the network can die under an open app without any NetInfo event, exactly
// the VPN black-hole case); after a failed probe, retry faster so recovery is
// picked up promptly. NetInfo state changes and app foregrounding also
// trigger an immediate probe, so these timers are only the fallback cadence.
const API_PROBE_VERIFY_INTERVAL_MS = 30 * 1000;
const API_PROBE_RETRY_DELAY_MS = 10 * 1000;

/**
 * One end-to-end reachability check: GET the unauthenticated kiroku-api
 * health endpoint with a hard timeout. Only this proves the internet is
 * actually reachable on a path that matters to the app (it also covers
 * "internet up, Kiroku down"). Never rejects.
 *
 * Deliberately a plain `fetch` owned by the app: an earlier revision routed
 * this through `NetInfo.configure` instead, but on iOS that ships the whole
 * config object (including the `reachabilityTest` function) across the bridge
 * to the native module, which crashed release device builds at boot, and the
 * library probe is gated behind `useNativeReachability` on iOS anyway, so it
 * never ran. `cache: 'no-cache'` keeps a cached healthz response from
 * masquerading as live connectivity.
 *
 * getKirokuApiRoot() may still resolve to the prod root for a moment on
 * dev/adhoc builds (its environment lookup is async); prod healthz is a
 * valid, unauthenticated reachability target either way.
 */
async function probeApiReachability(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    CONST.NETWORK.MAX_PENDING_TIME_MS,
  );
  try {
    const response = await fetch(
      `${ApiUtils.getKirokuApiRoot()}${KIROKU_DIRECT_PATHS.HEALTHZ}`,
      {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal,
      },
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

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
    // flushing and dev builds aren't pinned offline. The API probe is also
    // skipped for local web, where requests can sit in "Pending" and aren't
    // a reliable offline signal.
    const isUsingEmulators = CONFIG.IS_USING_EMULATORS;
    const shouldProbeApi = !isUsingEmulators && !CONFIG.IS_USING_LOCAL_WEB;

    let recheckTimer: ReturnType<typeof setTimeout> | null = null;
    let recheckAttempts = 0;
    let lastIsOffline: boolean | null = null;
    let isUnmounted = false;
    let lastNetInfoState: Pick<
      NetInfoState,
      'isConnected' | 'isInternetReachable'
    > = {isConnected: null, isInternetReachable: null};
    let isApiReachable: boolean | null = null;
    let probeTimer: ReturnType<typeof setTimeout> | null = null;
    let isProbeInFlight = false;

    // Mirror device connectivity into both the local context value (drives the
    // OfflineIndicator/UX) and the NETWORK Onyx key. The latter is what
    // NetworkStore.isOffline() and useNetwork() read, so populating it here is
    // what lets the request queue defer writes while offline and replay them on
    // reconnect. This is the single writer of the NETWORK key's connectivity
    // fields while NetworkConnection.subscribeToNetInfo() stays disabled.
    const applyConnectivity = (state: NetInfoState | null, reason: string) => {
      if (isUnmounted) {
        return;
      }
      if (state) {
        lastNetInfoState = state;
      }
      const {isOffline, isDetermined, networkStatus} = deriveConnectivity(
        lastNetInfoState,
        isUsingEmulators,
        isApiReachable,
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
        NetInfo.refresh()
          .then(freshState => {
            applyConnectivity(
              freshState,
              'NetInfo recheck (undetermined state)',
            );
          })
          .catch(() => {});
      }, UNDETERMINED_RECHECK_DELAY_MS);
    };

    const scheduleNextProbe = () => {
      if (!shouldProbeApi || isUnmounted || probeTimer) {
        return;
      }
      probeTimer = setTimeout(
        () => {
          probeTimer = null;
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          runProbe('API reachability probe (periodic)');
        },
        isApiReachable === false
          ? API_PROBE_RETRY_DELAY_MS
          : API_PROBE_VERIFY_INTERVAL_MS,
      );
    };

    const runProbe = (reason: string) => {
      if (!shouldProbeApi || isUnmounted || isProbeInFlight) {
        return;
      }
      if (probeTimer) {
        clearTimeout(probeTimer);
        probeTimer = null;
      }
      isProbeInFlight = true;
      probeApiReachability().then(reachable => {
        isProbeInFlight = false;
        if (isUnmounted) {
          return;
        }
        if (isApiReachable !== reachable) {
          isApiReachable = reachable;
          applyConnectivity(null, reason);
        }
        scheduleNextProbe();
      });
    };

    // Subscribe to network state updates. Every OS-level transition is also a
    // good moment to re-verify end-to-end reachability.
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      applyConnectivity(state, 'NetInfo state change event');
      runProbe('API reachability probe (NetInfo state change)');
    });

    // Check the initial network status
    NetInfo.fetch()
      .then(state => {
        applyConnectivity(state, 'NetInfo initial fetch');
      })
      .catch(() => {});
    runProbe('API reachability probe (initial)');

    // Re-evaluate on every return to the foreground: while backgrounded the
    // app can miss NetInfo events, and a state that "changed while we were not
    // looking" otherwise goes unnoticed until the next OS-level transition.
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (nextAppState !== 'active') {
          return;
        }
        NetInfo.refresh()
          .then(state => {
            applyConnectivity(state, 'NetInfo recheck (app foregrounded)');
          })
          .catch(() => {});
        runProbe('API reachability probe (app foregrounded)');
      },
    );

    return () => {
      isUnmounted = true;
      if (recheckTimer) {
        clearTimeout(recheckTimer);
      }
      if (probeTimer) {
        clearTimeout(probeTimer);
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
