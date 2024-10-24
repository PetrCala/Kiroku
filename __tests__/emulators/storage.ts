require('dotenv').config(); // Use .env variables in this file - CONFIG does not work here
import type {FirebaseApp} from 'firebase/app';
import {initializeApp, deleteApp} from 'firebase/app';
import * as firebaseJson from '../../firebase.json';
import type {FirebaseStorage} from 'firebase/storage';
import {connectStorageEmulator, getStorage} from 'firebase/storage';
import CONFIG from '../../src/CONFIG';
import {getTestStorageBucket} from './utils';

function setup(): {
  testApp: FirebaseApp;
  storage: FirebaseStorage;
} {
  const storageBucket = getTestStorageBucket();
  const projectId = CONFIG.TEST_PROJECT_ID;

  const testApp: FirebaseApp = initializeApp({
    storageBucket: storageBucket,
    projectId: projectId,
  });

  const storage = getStorage();
  const storagePort = parseInt(firebaseJson.emulators.database.port);
  connectStorageEmulator(storage, 'localhost', storagePort);

  return {testApp, storage};
}

async function teardown(testApp: FirebaseApp): Promise<void> {
  await deleteApp(testApp); // Delete the app
}

async function fillWithMockData(storage: FirebaseStorage): Promise<void> {
  // TBA
}

const StorageEmulator = {setup, teardown, fillWithMockData};

export default StorageEmulator;
