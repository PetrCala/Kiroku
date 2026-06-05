import type {
  UserPriority,
  UserPriorityList,
} from '@src/types/various/Algorithms';
import type {UserStatus, UserStatusList} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {sumAllDrinks} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';

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
    let userPriority: UserPriority = 0;
    const userStatusData: UserStatus = userStatusList[userID];
    if (userStatusData) {
      userPriority = calculateUserPriority(userStatusData);
    }
    usersPriority[userID] = userPriority;
  });
  return usersPriority;
}

function calculateUserPriority(userStatusData: UserStatus): number {
  const lowestPrio = -1e10;

  const latestSession = userStatusData.latest_session;
  if (!latestSession) {
    return lowestPrio;
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
