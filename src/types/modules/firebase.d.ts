import type {Persistence, ReactNativeAsyncStorage} from 'firebase/auth';

declare function getReactNativePersistence(
  storage: ReactNativeAsyncStorage,
): Persistence;

declare module 'firebase/auth' {
  export {getReactNativePersistence};
}
