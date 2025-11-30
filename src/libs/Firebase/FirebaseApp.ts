import type {FirebaseApp as FirebaseAppProps} from 'firebase/app';
import {initializeApp, getApp, getApps} from 'firebase/app';
import type {Auth} from 'firebase/auth';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FirebaseConfig from './FirebaseConfig';

const currentApps = getApps();

/**
 * Firebase application instance.
 * If no apps are initialized, it initializes the Firebase app with the provided configuration.
 * Otherwise, it retrieves the existing Firebase app instance.
 */
const FirebaseApp: FirebaseAppProps =
  currentApps.length === 0 ? initializeApp(FirebaseConfig) : getApp();

/**
 * Firebase authentication instance.
 * If no apps are initialized, it initializes authentication with React Native persistence using AsyncStorage.
 * Otherwise, it retrieves the existing authentication instance.
 */
const auth: Auth =
  currentApps.length === 0
    ? initializeAuth(FirebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      })
    : getAuth(FirebaseApp);

export {FirebaseApp, auth};
export type {FirebaseAppProps};
