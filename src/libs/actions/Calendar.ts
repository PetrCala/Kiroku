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

/**
 * Reset the calendar's cross-screen sync state on a cold launch so the home and
 * profile calendars always open on the current month, regardless of where the
 * user was when they last closed the app.
 *
 * Why `Onyx.merge(key, null)` and not `Onyx.init`'s `initialKeyStates` or
 * `Onyx.set`: Onyx drops null defaults during hydration
 * (`shouldRemoveNestedNulls`), so a value persisted from a previous session
 * survives `initialKeyStates: null`. `Onyx.set(key, null)` also no-ops here, it
 * early-returns on the empty pre-hydration cache. `Onyx.merge` reads the stored
 * value first, then removes it (delete + broadcast). Called from `setup` before
 * the React tree mounts, so the value is cleared before any screen subscribes
 * (no month "flip").
 */
function resetCalendarStateForColdLaunch(): void {
  Onyx.merge(ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE, null);
  Onyx.merge(ONYXKEYS.SESSIONS_CALENDAR_MONTHS_LOADED, null);
}

export {
  setSessionsCalendarMonthsLoadedForUser,
  resetCalendarStateForColdLaunch,
};
