require('dotenv').config(); // Use .env variables in this file - CONFIG does not work here
import {
  getDatabase,
  connectDatabaseEmulator,
  goOffline,
} from 'firebase/database';
import type {FirebaseApp} from 'firebase/app';
import {initializeApp, deleteApp} from 'firebase/app';
import type {Database} from 'firebase/database';
import * as firebaseJson from '../../../firebase.json';
import {createMockDatabase} from '../mockDatabase';
import {ref, set} from 'firebase/database';
import CONFIG from '../../../src/CONFIG';
import {getTestDatabaseURL} from './emulatorUtils';

export function setupRealtimeDatabaseTestEnv(): {
  testApp: FirebaseApp;
  db: Database;
} {
  const databaseURL = getTestDatabaseURL();
  const projectId = CONFIG.TEST_PROJECT_ID;

  const testApp: FirebaseApp = initializeApp({
    databaseURL: databaseURL,
    projectId: projectId,
  });

  // Initialize the database
  const db: Database = getDatabase(testApp);
  const dbPort = parseInt(firebaseJson.emulators.database.port);
  connectDatabaseEmulator(db, 'localhost', dbPort);

  return {testApp, db};
}

export async function teardownRealtimeDatabaseTestEnv(
  testApp: FirebaseApp,
  db: Database,
): Promise<void> {
  goOffline(db); // Close database connection
  await deleteApp(testApp); // Delete the app
}

/** Given a database object, fill it with mock data.
 *
 * @param db Firebase Database object.
 * @param noFriends If set to true, no friends or friend requests will be created.
 * @returns The updated Database object.
 */
export async function fillDatabaseWithMockData(
  db: any,
  noFriends = false,
): Promise<void> {
  const mockDatabase = createMockDatabase(noFriends);
  await set(ref(db), mockDatabase);
  return db;
}
