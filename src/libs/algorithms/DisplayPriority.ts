import {UserPriority, UserPriorityList} from '@src/types/various/Algorithms';
import {UserStatus, UserStatusList} from '@src/types/database';
import {sumAllDrinks} from '@libs/DataHandling';

/**
 * Based on the user status data, calculate the display priority of the users.
 * Return the user IDs in the order they should be displayed.
 *
 * @param userIds Array of user IDs to calculate the display priority for.
 * @param usersPriority Object containing the display priority of each user.
 */
function orderUsersByPriority(
  userIds: string[],
  usersPriority: UserPriorityList,
): string[] {
  return userIds.sort((a, b) => usersPriority[b] - usersPriority[a]);
}

function calculateAllUsersPriority(
  userIds: string[],
  userStatusList: UserStatusList,
): UserPriorityList {
  let usersPriority: UserPriorityList = {};
  userIds.forEach(userId => {
    let userPriority: UserPriority = 0;
    let userStatusData: UserStatus = userStatusList[userId];
    if (userStatusData) {
      userPriority = calculateUserPriority(userStatusData);
    }
    usersPriority[userId] = userPriority;
  });
  return usersPriority;
}

function calculateUserPriority(userStatusData: UserStatus): number {
  let time_since_last_online =
    new Date().getTime() - userStatusData.last_online;
  let session_active = userStatusData.latest_session?.ongoing ? 1 : 0;
  let session_drinks = userStatusData.latest_session?.drinks
    ? sumAllDrinks(userStatusData.latest_session.drinks) // TODO units should be used here perhaps
    : 0;
  return (
    session_drinks * 10 +
    session_active * 100 -
    Math.log(time_since_last_online) * 50
  );
}

export {calculateAllUsersPriority, calculateUserPriority, orderUsersByPriority};
