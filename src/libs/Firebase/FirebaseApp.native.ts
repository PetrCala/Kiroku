import {
  getCrashlytics,
  log,
  recordError,
} from '@react-native-firebase/crashlytics';
import type {FirebaseApp as FirebaseAppProps} from 'firebase/app';
import {initializeApp, getApp, getApps} from 'firebase/app';
import type {Auth} from 'firebase/auth';
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Log from '@libs/Log';
import CONFIG from '@src/CONFIG';
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
 * Single auth instance for the process. Assigned only on a SUCCESSFUL
 * `initializeAuth`/`getAuth` call, so a thrown attempt leaves it `null` and the
 * next call retries (self-heals) rather than caching a broken instance.
 */
let firebaseAuth: Auth | null = null;

/**
 * Surface a persistence-init failure in production. Native `Log.*` only reaches
 * the Metro/Xcode console (its network sink is a stub), so an AsyncStorage
 * persistence failure — which silently logs the user out on every cold start —
 * would otherwise be invisible. Crashlytics is the real production sink (already
 * wired in `platformSetup`). Gated + wrapped so reporting can never break auth init.
 */
function reportPersistenceFailure(message: string, error: unknown): void {
  if (!CONFIG.SEND_CRASH_REPORTS) {
    return;
  }
  try {
    const crashlytics = getCrashlytics();
    log(crashlytics, message);
    recordError(
      crashlytics,
      error instanceof Error ? error : new Error(message),
    );
  } catch {
    // Never let crash reporting itself break auth initialization.
  }
}

/**
 * Initialize Firebase Auth with AsyncStorage persistence so the session survives
 * a cold start. Idempotent: returns the existing instance if already created.
 *
 * Call this ONCE, eagerly, from `setup()` after the native bridge is up (see
 * `src/setup/index.ts`) rather than relying on whichever module happens to call
 * `getFirebaseAuth()` first — initializing before AsyncStorage is ready pins auth
 * to a non-persistent instance for the whole process, which is exactly the
 * "logged out on every relaunch" bug this guards against.
 *
 * AsyncStorage persistence is the one that matters; the in-memory / `getAuth`
 * fallbacks keep the app running but do NOT persist, so each is reported loudly.
 */
function initFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  try {
    firebaseAuth = initializeAuth(FirebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    Log.info('[Firebase] Auth initialized with AsyncStorage persistence');
    return firebaseAuth;
  } catch (error) {
    // Severe: without AsyncStorage persistence the session is never written on
    // sign-in nor restored on relaunch, so the user is silently logged out on
    // every cold start. Make it observable instead of degrading quietly.
    Log.warn(
      '[Firebase] AsyncStorage persistence unavailable, falling back to memory. Error:',
      {error},
    );
    reportPersistenceFailure(
      '[Firebase] AsyncStorage persistence FAILED - session will NOT persist across relaunch',
      error,
    );
  }

  try {
    firebaseAuth = initializeAuth(FirebaseApp, {
      persistence: inMemoryPersistence,
    });
    Log.info('[Firebase] Auth initialized with memory persistence (fallback)');
    return firebaseAuth;
  } catch (fallbackError) {
    // Even in-memory init failed. `getAuth` keeps the app from crashing but
    // returns a no-persistence instance (strictly worse), so record it as a
    // hard error rather than landing there silently.
    Log.alert(
      '[Firebase] Failed to initialize auth with persistence, using getAuth:',
      {fallbackError},
    );
    reportPersistenceFailure(
      '[Firebase] initializeAuth failed entirely - using no-persistence getAuth()',
      fallbackError,
    );
    firebaseAuth = getAuth(FirebaseApp);
    return firebaseAuth;
  }
}

/**
 * Get the Firebase Auth instance. Returns the eagerly-initialized singleton
 * (see `initFirebaseAuth`), initializing on demand as a fallback for any caller
 * that runs before `setup()`.
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
