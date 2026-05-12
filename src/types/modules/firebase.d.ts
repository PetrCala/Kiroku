import type {Persistence, ReactNativeAsyncStorage} from 'firebase/auth';

declare function getReactNativePersistence(
  storage: ReactNativeAsyncStorage,
): Persistence;

declare module 'firebase/auth' {
  // eslint-disable-next-line import/prefer-default-export
  export {getReactNativePersistence};
}
