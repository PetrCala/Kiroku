import type {Persistence, ReactNativeAsyncStorage} from 'firebase/auth';

declare function getReactNativePersistence(
  storage: ReactNativeAsyncStorage,
): Persistence;

// Browser-only persistence layers used by the web build (`FirebaseApp.ts`).
// tsc resolves `firebase/auth` to the react-native types (expo's
// `customConditions: ["react-native"]`), which omit these even though the
// browser bundle webpack uses exports them.
declare const indexedDBLocalPersistence: Persistence;
declare const browserLocalPersistence: Persistence;

declare module 'firebase/auth' {
  export {
    getReactNativePersistence,
    indexedDBLocalPersistence,
    browserLocalPersistence,
  };
}
