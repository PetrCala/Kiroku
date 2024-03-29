require('dotenv').config(); // for the process.env variables to read the .env file
import CONST from '@src/CONST';

// Perhaps if this grows too largs, rewrite into a module export
export const shouldRunTests =
  process.env.APP_ENVIRONMENT === CONST.ENVIRONMENT.TEST;
export const describeWithEmulator = shouldRunTests ? describe : describe.skip;

export async function makeFriends(
  authDb: any,
  userId1: string,
  userId2: string,
) {
  const friendRef = authDb.ref(`users/${userId1}/friends/${userId2}`);
  const friendRef2 = authDb.ref(`users/${userId2}/friends/${userId1}`);
  await friendRef.set(true);
  await friendRef2.set(true);
}
