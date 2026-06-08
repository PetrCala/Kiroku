import type {ReactNode} from 'react';
import {createContext, useContext, useMemo} from 'react';
import type {Auth} from 'firebase/auth';
import {connectAuthEmulator} from 'firebase/auth';
import {isConnectedToAuthEmulator} from '@src/libs/Firebase/FirebaseUtils';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import FirebaseConfig from '@libs/Firebase/FirebaseConfig';
import CONFIG from '@src/CONFIG';

type FirebaseContextProps = {
  auth: Auth;
};

const FirebaseContext = createContext<FirebaseContextProps | null>(null);

/** Fetch the FirebaseContext. If the context does not exist, throw an error.
 *
 * @example { auth } = useFirebase();
 */
const useFirebase = (): FirebaseContextProps => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error(
      'firebaseContext must be used within a FirebaseContextProvider',
    );
  }
  return context;
};

type FirebaseProviderProps = {
  children: ReactNode;
};

/** Provide a firebase context to the application
 */
function FirebaseProvider({children}: FirebaseProviderProps) {
  const value = useMemo(() => {
    // CRITICAL: Initialize auth with lazy getter to ensure native modules are ready
    // This is called in useMemo which runs after component mounts, ensuring React Native
    // bridge is fully initialized. Direct import would execute at module load time and crash.
    const auth = getFirebaseAuth();

    // Check if emulators should be used
    if (CONFIG.IS_USING_EMULATORS) {
      console.debug('The app is running in testing mode.');

      console.debug('Connecting to Firebase Emulators...');

      if (!FirebaseConfig.authDomain) {
        throw new Error('Auth URL not defined in FirebaseConfig');
      }

      if (!isConnectedToAuthEmulator(auth)) {
        connectAuthEmulator(auth, CONFIG.EMULATORS.AUTH_URL);
      }
    }
    return {auth};
  }, []);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export {useFirebase, FirebaseProvider};
