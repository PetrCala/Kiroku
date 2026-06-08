import type {Auth} from 'firebase/auth';
import CONFIG from '@src/CONFIG';

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

export {
  // eslint-disable-next-line import/prefer-default-export
  isConnectedToAuthEmulator,
};
