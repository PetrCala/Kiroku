require('dotenv').config(); // for the process.env variables to read the .env file
import type {Auth} from 'firebase/auth';
import {
  initializeAuth,
  getReactNativePersistence,
  connectAuthEmulator,
  updateProfile,
} from 'firebase/auth';
import type {FirebaseApp} from 'firebase/app';
import {initializeApp, deleteApp} from 'firebase/app';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import {isConnectedToAuthEmulator} from '@src/libs/Firebase/FirebaseUtils';
import {signUpUserWithEmailAndPassword} from '@src/libs/auth/auth';
import CONFIG from '@src/CONFIG';
import {MOCK_USER_IDS} from '../utils/testsStatic';
import {getTestAuthDomain} from './utils';

function setup(): {
  testApp: FirebaseApp;
  auth: Auth;
} {
  const authDomain = getTestAuthDomain();
  const projectId = CONFIG.TEST_PROJECT_ID;

  const testApp = initializeApp({
    authDomain: authDomain,
    projectId: projectId,
  });

  const auth = initializeAuth(testApp, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
  connectAuthEmulator(auth, authDomain);

  return {testApp, auth};
}

async function teardown(testApp: FirebaseApp): Promise<void> {
  await deleteApp(testApp); // Delete the app
}

/** Using an emulator authentication object, create authenticated users
 * in the authentication emulator.
 *
 * @param emulatorAuth Auth object from the emulator.
 * @returns Promise<void>
 */
async function createMockUsers(emulatorAuth: Auth): Promise<void> {
  if (!isConnectedToAuthEmulator) {
    throw new Error('Not connected to the auth emulator');
  }
  MOCK_USER_IDS.forEach(userID => async () => {
    const email = `${userID}@gmail.com`;
    const password = 'mock-password';

    try {
      await signUpUserWithEmailAndPassword(emulatorAuth, email, password);
    } catch (error) {
      throw new Error(`Error creating mock user ${userID}: ${error}`);
    }

    if (!emulatorAuth.currentUser) {
      throw new Error('Failed to create a new mock user');
    }
    try {
      await updateProfile(emulatorAuth.currentUser, {displayName: userID});
    } catch (error) {
      throw new Error(
        `Error updating profile data for mock user ${userID}: ${error}`,
      );
    }
  });
}

const AuthEmulator = {setup, teardown, createMockUsers};

export default AuthEmulator;
