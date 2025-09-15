import type {FriendRequestStatus} from '@src/types/onyx';
import type {Database} from 'firebase/database';
import {ref, get, update} from 'firebase/database';
import DBPATHS from '@src/DBPATHS';
import CONST from '@src/CONST';

const friendRef = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID;
const friendRequestRef = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID;

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
  const updates: Record<string, FriendRequestStatus> = {};
  updates[friendRequestRef.getRoute(userFrom, userTo)] =
    CONST.FRIEND_REQUEST_STATUS.SENT;
  updates[friendRequestRef.getRoute(userTo, userFrom)] =
    CONST.FRIEND_REQUEST_STATUS.RECEIVED;
  await update(ref(db), updates);
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
  const updates: Record<string, null> = {};
  updates[friendRequestRef.getRoute(userFrom, userTo)] = null;
  updates[friendRequestRef.getRoute(userTo, userFrom)] = null;
  await update(ref(db), updates);
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
  const updates: Record<string, boolean | null> = {};
  updates[friendRequestRef.getRoute(userFrom, userTo)] = null;
  updates[friendRequestRef.getRoute(userTo, userFrom)] = null;
  updates[friendRef.getRoute(userFrom, userTo)] = true;
  updates[friendRef.getRoute(userTo, userFrom)] = true;
  await update(ref(db), updates);
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
  const updates: Record<string, null> = {};
  updates[friendRef.getRoute(userFrom, userTo)] = null;
  updates[friendRef.getRoute(userTo, userFrom)] = null;
  await update(ref(db), updates);
}

export {
  acceptFriendRequest,
  deleteFriendRequest,
  isFriend,
  sendFriendRequest,
  unfriend,
};
