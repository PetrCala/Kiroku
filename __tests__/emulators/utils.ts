require('dotenv').config(); // for the process.env variables to read the .env file
import CONFIG from '@src/CONFIG';

const describeWithEmulator = CONFIG.IS_USING_EMULATORS
  ? describe
  : describe.skip;

async function makeFriends(authDb: any, userID1: string, userID2: string) {
  const friendRef = authDb.ref(`users/${userID1}/friends/${userID2}`);
  const friendRef2 = authDb.ref(`users/${userID2}/friends/${userID1}`);
  await friendRef.set(true);
  await friendRef2.set(true);
}

function getTestAuthDomain(): string {
  return `https://${CONFIG.TEST_HOST}:${CONFIG.TEST_AUTH_PORT}/?ns=${CONFIG.TEST_PROJECT_ID}`;
}

function getTestDatabaseURL(): string {
  return `https://${CONFIG.TEST_HOST}:${CONFIG.TEST_REALTIME_DATABASE_PORT}?ns=${CONFIG.TEST_PROJECT_ID}`;
}

function getTestStorageBucket(): string {
  return `https://${CONFIG.TEST_PROJECT_ID}:${CONFIG.TEST_STORAGE_BUCKET_PORT}/?ns=${CONFIG.TEST_PROJECT_ID}`;
}

export {
  getTestAuthDomain,
  getTestDatabaseURL,
  getTestStorageBucket,
  makeFriends,
  describeWithEmulator,
};
