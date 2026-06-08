import type {ReactNode} from 'react';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
import CONFIG from '@src/CONFIG';

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
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected as boolean | undefined);
    });

    // Check the initial network status
    NetInfo.fetch().then(state => {
      const isConnected = state.isConnected as boolean | undefined;
      // When running against the local emulator suite NetInfo may report an
      // unknown status; treat that as online so dev builds aren't stuck offline.
      setIsOnline(isConnected ?? CONFIG.IS_USING_EMULATORS);
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
