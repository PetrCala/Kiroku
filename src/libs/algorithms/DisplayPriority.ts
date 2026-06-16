import type {
  UserPriority,
  UserPriorityList,
} from '@src/types/various/Algorithms';
import type {UserStatus, UserStatusList} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {sumAllDrinks} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';

/**
 * Floor priority for users with no usable session signal: those whose latest
 * session is missing/expired and those absent from `userStatusList` entirely (a
 * friend who hid their drinking data, whose `user_status` the server evicts).
 * Keeps both in the bottom band instead of letting a hidden friend — which used
 * to default to `0` — float above genuinely idle friends.
 */
const LOWEST_PRIORITY = -1e10;

/**
 * Based on the user status data, calculate the display priority of the users.
 * Return the user IDs in the order they should be displayed.
 *
 * @param userIDs Array of user IDs to calculate the display priority for.
 * @param usersPriority Object containing the display priority of each user.
 */
function orderUsersByPriority(
  userIDs: UserID[],
  usersPriority: UserPriorityList,
): string[] {
  // Copy before sorting — `Array.prototype.sort` mutates in place, and callers
  // pass arrays they keep rendering from (the friend list / its subset).
  return [...userIDs].sort((a, b) => usersPriority[b] - usersPriority[a]);
}

function calculateAllUsersPriority(
  userIDs: UserID[],
  userStatusList: UserStatusList,
): UserPriorityList {
  const usersPriority: UserPriorityList = {};
  userIDs.forEach(userID => {
    // Absent from `userStatusList` → no readable status (e.g. a friend who hid
    // their data; the server evicts their `user_status`). Floor them into the
    // bottom band rather than the old `0`, which floated them above idle friends.
    let userPriority: UserPriority = LOWEST_PRIORITY;
    const userStatusData: UserStatus = userStatusList[userID];
    if (userStatusData) {
      userPriority = calculateUserPriority(userStatusData);
    }
    usersPriority[userID] = userPriority;
  });
  return usersPriority;
}

function calculateUserPriority(userStatusData: UserStatus): number {
  const latestSession = userStatusData.latest_session;
  if (!latestSession) {
    return LOWEST_PRIORITY;
  }

  const latestSessionTime = latestSession ? latestSession.start_time : null;
  const timeSinceLastSession = latestSessionTime
    ? new Date().getTime() - latestSessionTime
    : 1e15;
  const expired = DSUtils.sessionIsExpired(latestSession);
  // The older the last session, the lower the priority
  const timeCoefficient = Math.log(timeSinceLastSession) * 50 * -1;
  if (expired) {
    return timeCoefficient;
  } // Do not account for session if expired

  const sessionActive = latestSession?.ongoing ? 1 : 0;
  const sessionDrinks = latestSession?.drinks
    ? sumAllDrinks(latestSession.drinks) // TODO units should be used here perhaps
    : 0;
  return (
    sessionActive * 500 +
    sessionDrinks * sessionActive * 10 + // Only count active sessions
    timeCoefficient
  );
}

export {calculateAllUsersPriority, calculateUserPriority, orderUsersByPriority};
