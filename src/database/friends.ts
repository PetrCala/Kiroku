import type {Database} from 'firebase/database';
import {ref, get} from 'firebase/database';
import DBPATHS from '@src/DBPATHS';
import {getFunctionsApiBaseUrl} from '@src/libs/ApiConfig';
import {auth} from '@libs/Firebase/FirebaseApp';
import {createApiClient} from '@kiroku/api-client';

const friendRef = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID;

/**
 * Check if userB is in userA's friend list.
 *
 * @param db - The database object against which to validate this conditio
 * @param userA - User ID of the authenticated user.
 * @param userB - User ID of the friend being checked.
 * @returns Returns true if userB is a friend of userA, otherwise false.
 */
async function isFriend(
  db: Database,
  userA: string,
  userB: string,
): Promise<boolean> {
  const dbRef = ref(db, friendRef.getRoute(userA, userB));
  const snapshot = await get(dbRef);
  return snapshot.exists();
}

/**
 * Send a friend request from one user to another using
 * their database IDs.
 *
 * @param db Firebase Database object.
 * @param userFrom ID of the user that sends
 *  the request.
 * @param userTo ID of the user to whom the
 *  request is being sent to. Also serves as the request ID.
 * @returns An empty promise.
 * @throws Alert: In case the database fails to
 *  save the data.
 */
async function sendFriendRequest(
  db: Database,
  userFrom: string,
  userTo: string,
): Promise<void> {
  const baseUrl = getFunctionsApiBaseUrl();
  const client = createApiClient({
    baseUrl,
    getToken: () => auth.currentUser?.getIdToken(),
  });
  await client.friends.request(userTo);
}

/**
 * Remove from the database friend request data that existed between two users.
 *
 * @param db Firebase Database object.
 * @param userFrom ID of user 1.
 * @param userTo ID of user 2.
 * @returns
 * @throws In case the database fails to
 *  save the data.
 */
async function deleteFriendRequest(
  db: Database,
  userFrom: string,
  userTo: string,
): Promise<void> {
  const baseUrl = getFunctionsApiBaseUrl();
  const client = createApiClient({
    baseUrl,
    getToken: () => auth.currentUser?.getIdToken(),
  });
  // userFrom is the current user; server derives it from token.
  await client.friends.deleteRequest(userTo);
}

/**
 * Accept a friend request sent from another user.
 *
 * @param db Firebase Database object.
 * @param userFrom ID of the user that is accepting the request
 * @param userTo ID of the user that sent the request.
 * @returns
 * @throws In case the database fails to
 *  save the data.
 */
async function acceptFriendRequest(
  db: Database,
  userFrom: string,
  userTo: string,
): Promise<void> {
  const baseUrl = getFunctionsApiBaseUrl();
  const client = createApiClient({
    baseUrl,
    getToken: () => auth.currentUser?.getIdToken(),
  });
  // In current signature, userTo is the original sender of the request.
  await client.friends.accept(userTo);
}

/**
 * Remove from the database friend status data that existed between two users.
 *
 * @param db Firebase Database object.
 * @param userFrom ID of user 1.
 * @param userTo ID of user 2.
 * @returns
 * @throws In case the database fails to save the data.
 */
async function unfriend(
  db: Database,
  userFrom: string,
  userTo: string,
): Promise<void> {
  const baseUrl = getFunctionsApiBaseUrl();
  const client = createApiClient({
    baseUrl,
    getToken: () => auth.currentUser?.getIdToken(),
  });
  await client.friends.remove(userTo);
}

export {
  acceptFriendRequest,
  deleteFriendRequest,
  isFriend,
  sendFriendRequest,
  unfriend,
};

// Base URL now resolved via ApiConfig
