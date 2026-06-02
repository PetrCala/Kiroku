import type {ReactNode} from 'react';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
import isBoolean from 'lodash/isBoolean';
import * as NetworkActions from '@userActions/Network';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';

type UserConnectionContextProps = {
  isOnline: boolean | undefined;
};

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

    // Mirror device connectivity into both the local context value (drives the
    // OfflineIndicator/UX) and the NETWORK Onyx key. The latter is what
    // NetworkStore.isOffline() and useNetwork() read, so populating it here is
    // what lets the request queue defer writes while offline and replay them on
    // reconnect. This is the single writer of the NETWORK key's connectivity
    // fields while NetworkConnection.subscribeToNetInfo() stays disabled.
    const applyConnectivity = (isConnected: boolean | null | undefined) => {
      const online = isUsingEmulators || isConnected !== false;
      setIsOnline(online);
      NetworkActions.setIsOffline(!online);

      let networkStatus;
      if (isUsingEmulators || !isBoolean(isConnected)) {
        networkStatus = isUsingEmulators
          ? CONST.NETWORK.NETWORK_STATUS.ONLINE
          : CONST.NETWORK.NETWORK_STATUS.UNKNOWN;
      } else {
        networkStatus = isConnected
          ? CONST.NETWORK.NETWORK_STATUS.ONLINE
          : CONST.NETWORK.NETWORK_STATUS.OFFLINE;
      }
      NetworkActions.setNetWorkStatus(networkStatus);
    };

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      applyConnectivity(state.isConnected);
    });

    // Check the initial network status
    NetInfo.fetch().then(state => {
      applyConnectivity(state.isConnected);
    });

    // Unsubscribe to clean up the subscription
    return () => {
      unsubscribe();
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

export {UserConnectionContext, useUserConnection, UserConnectionProvider};
export type {UserConnectionContextProps};
