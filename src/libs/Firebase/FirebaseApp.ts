import type {FirebaseApp as FirebaseAppProps} from 'firebase/app';
import {initializeApp, getApp, getApps} from 'firebase/app';
import type {Auth} from 'firebase/auth';
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import Log from '@libs/Log';
import FirebaseConfig from './FirebaseConfig';

const currentApps = getApps();

/**
 * Firebase application instance (web).
 * If no apps are initialized, it initializes the Firebase app with the provided configuration.
 * Otherwise, it retrieves the existing Firebase app instance.
 *
 * Web counterpart of `FirebaseApp.native.ts`. The web `firebase/auth` SDK does NOT
 * export `getReactNativePersistence`, so this file uses the browser persistence layers
 * (IndexedDB, falling back to localStorage) instead of AsyncStorage.
 */
const FirebaseApp: FirebaseAppProps =
  currentApps.length === 0 ? initializeApp(FirebaseConfig) : getApp();

/**
 * Single auth instance for the page. Assigned only on a SUCCESSFUL
 * `initializeAuth`/`getAuth` call, so a thrown attempt leaves it `null` and the
 * next call retries rather than caching a broken instance.
 */
let firebaseAuth: Auth | null = null;

/**
 * Initialize Firebase Auth for web. Idempotent: returns the existing instance if
 * already created. Mirrors the native `initFirebaseAuth` export surface so the
 * shared `setup()` can call it without platform branching.
 *
 * The session is persisted via IndexedDB so it survives a full page reload,
 * falling back to localStorage when IndexedDB is unavailable (e.g. private
 * browsing). Memory persistence is the last resort so auth init never crashes.
 */
function initFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  try {
    // Passing an ordered list lets Firebase pick the first available persistence,
    // so a missing IndexedDB transparently falls back to localStorage.
    firebaseAuth = initializeAuth(FirebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
    Log.info('[Firebase] Auth initialized with browser persistence');
    return firebaseAuth;
  } catch (error) {
    // Fallback to memory persistence if both browser persistence layers fail.
    Log.warn(
      '[Firebase] Browser persistence unavailable, using memory persistence. Error:',
      {error},
    );
  }

  try {
    firebaseAuth = initializeAuth(FirebaseApp, {
      persistence: inMemoryPersistence,
    });
    Log.info('[Firebase] Auth initialized with memory persistence (fallback)');
    return firebaseAuth;
  } catch (fallbackError) {
    // If even memory persistence fails, try getAuth as last resort.
    Log.alert(
      '[Firebase] Failed to initialize auth with persistence, using getAuth:',
      {fallbackError},
    );
    firebaseAuth = getAuth(FirebaseApp);
    return firebaseAuth;
  }
}

/**
 * Get the Firebase Auth instance, initializing on demand for any caller that
 * runs before `setup()`.
 *
 * @example
 * // Via FirebaseContext (recommended):
 * const {auth} = useFirebase();
 */
function getFirebaseAuth(): Auth {
  return firebaseAuth ?? initFirebaseAuth();
}

export {FirebaseApp, getFirebaseAuth, initFirebaseAuth};
export type {FirebaseAppProps};
