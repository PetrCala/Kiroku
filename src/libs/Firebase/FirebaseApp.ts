import type {FirebaseApp as FirebaseAppProps} from 'firebase/app';
import {initializeApp, getApp, getApps} from 'firebase/app';
import type {Auth} from 'firebase/auth';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Log from '@libs/Log';
import FirebaseConfig from './FirebaseConfig';

const currentApps = getApps();

/**
 * Firebase application instance.
 * If no apps are initialized, it initializes the Firebase app with the provided configuration.
 * Otherwise, it retrieves the existing Firebase app instance.
 *
 * Note: FirebaseApp initialization is safe at import time as it doesn't use native modules.
 */
const FirebaseApp: FirebaseAppProps =
  currentApps.length === 0 ? initializeApp(FirebaseConfig) : getApp();

/**
 * Lazy auth instance - initialized on first access to avoid accessing AsyncStorage
 * (a native module) before React Native's native bridge is ready.
 *
 * CRITICAL: In production builds with Hermes bytecode + inlineRequires: true,
 * all module imports execute immediately. If we initialize auth at import time
 * with AsyncStorage persistence, it will crash because native modules aren't
 * ready yet during RCTJSThreadManager initialization.
 */
let firebaseAuth: Auth | null = null;

/**
 * Get Firebase Auth instance with lazy initialization.
 *
 * This function defers auth initialization until first access, ensuring React Native's
 * native bridge is ready. It attempts AsyncStorage persistence first, falling back to
 * memory persistence if AsyncStorage is unavailable.
 *
 * @returns Firebase Auth instance
 *
 * @example
 * // In a React component (after mount):
 * const auth = getFirebaseAuth();
 *
 * @example
 * // Via FirebaseContext (recommended):
 * const {auth} = useFirebase();
 */
function getFirebaseAuth(): Auth {
  // Return existing instance if already initialized
  if (firebaseAuth) {
    return firebaseAuth;
  }

  try {
    // Try to initialize with AsyncStorage persistence
    // This will work if called after React Native bridge is ready
    firebaseAuth = initializeAuth(FirebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    Log.info('[Firebase] Auth initialized with AsyncStorage persistence');
  } catch (error) {
    // Fallback to memory persistence if AsyncStorage not available
    // This ensures the app doesn't crash even if native modules have issues
    Log.warn(
      '[Firebase] AsyncStorage not available, using memory persistence. Error:',
      {error},
    );

    try {
      firebaseAuth = initializeAuth(FirebaseApp, {
        persistence: inMemoryPersistence,
      });
      Log.info(
        '[Firebase] Auth initialized with memory persistence (fallback)',
      );
    } catch (fallbackError) {
      // If even memory persistence fails, try getAuth as last resort
      Log.alert(
        '[Firebase] Failed to initialize auth with persistence, using getAuth:',
        {fallbackError},
      );
      firebaseAuth = getAuth(FirebaseApp);
    }
  }

  return firebaseAuth;
}

export {FirebaseApp, getFirebaseAuth};
export type {FirebaseAppProps};
