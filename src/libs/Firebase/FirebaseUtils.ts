import type {FirebaseStorage} from 'firebase/storage';
import type {Auth} from 'firebase/auth';
import CONFIG from '@src/CONFIG';

/**
 * Checks if the Firebase Storage instance is connected to an emulator.
 *
 * @param storage The Firebase Storage instance.
 * @returns True if connected to the emulator, false otherwise.
 * @example
 * const storage = getStorage();
 * const connectedToStorageEmulator = isConnectedToStorageEmulator(storage);
 * console.log('Connected to Storage Emulator:', connectedToStorageEmulator);
 */
function isConnectedToStorageEmulator(storage: FirebaseStorage): boolean {
  const storageConfig = storage.app.options.storageBucket;
  if (!storageConfig) {
    return false;
  }
  return storageConfig.includes(
    `${CONFIG.EMULATORS.HOST}:${CONFIG.EMULATORS.STORAGE_BUCKET_PORT}`,
  );
}

/**
 * Checks if the Firebase Authentication instance is connected to an emulator.
 *
 * @param auth The Firebase Auth instance.
 * @returns True if connected to the emulator, false otherwise.
 * @example
 * const auth = getAuth();
 * const connectedToAuthEmulator = isConnectedToAuthEmulator(auth);
 * console.log('Connected to Auth Emulator:', connectedToAuthEmulator);
 */
function isConnectedToAuthEmulator(auth: Auth): boolean {
  const authConfig = auth.app.options.authDomain;
  if (!authConfig) {
    return false;
  }
  return authConfig.includes(
    `${CONFIG.EMULATORS.HOST}:${CONFIG.EMULATORS.AUTH_PORT}`,
  );
}

export {isConnectedToAuthEmulator, isConnectedToStorageEmulator};
