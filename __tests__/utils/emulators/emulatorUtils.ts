require('dotenv').config(); // for the process.env variables to read the .env file
import CONST from '../../../src/CONST';
import CONFIG from '../../../src/CONFIG';

// Perhaps if this grows too largs, rewrite into a module export
const shouldRunTests = process.env.ENVIRONMENT === CONST.ENVIRONMENT.TEST;
const describeWithEmulator = shouldRunTests ? describe : describe.skip;

async function makeFriends(authDb: any, userId1: string, userId2: string) {
  const friendRef = authDb.ref(`users/${userId1}/friends/${userId2}`);
  const friendRef2 = authDb.ref(`users/${userId2}/friends/${userId1}`);
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
  shouldRunTests,
  describeWithEmulator,
};
