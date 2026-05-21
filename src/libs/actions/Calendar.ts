import ONYXKEYS from '@src/ONYXKEYS';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import Onyx from 'react-native-onyx';

/**
 * Persist how many months back the sessions calendar has been scrolled for a
 * given user. The value is read by the Firebase session listener (auth user)
 * and the friend-profile fetcher to size their `start_time` window.
 */
function setSessionsCalendarMonthsLoadedForUser(
  userID: UserID,
  monthsLoaded: number,
): void {
  Onyx.merge(
    `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID}`,
    monthsLoaded,
  );
}

export {
  // eslint-disable-next-line import/prefer-default-export
  setSessionsCalendarMonthsLoadedForUser,
};
