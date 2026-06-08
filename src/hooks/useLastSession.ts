import {useMemo} from 'react';
import {formatDistanceToNow} from 'date-fns';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import {timestampToDateString} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {DateString} from '@src/types/onyx/OnyxCommon';

type LastSessionView = {
  /** Relative time of the session start, e.g. "3 days ago". */
  when: string;
  /** Formatted total units, e.g. "4.5". */
  units: string;
  /** `yyyy-MM-dd` of the session, for day-overview navigation. */
  dateString: DateString;
};

function formatUnits(value: number): string {
  // 1 decimal for partial units, else integer — the app-wide units norm.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * The user's most recent COMPLETED session, formatted for the home "last
 * session" banner. `null` when there is no completed session (brand-new user,
 * or only an ongoing session) — the caller renders no banner in that case.
 *
 * Relative time is English, matching the app's existing `datetimeToRelative`.
 */
function useLastSession(): LastSessionView | null {
  const drinkingSessionData = useCurrentUserDrinkingSessions();
  const preferences = useCurrentUserPreferences();
  const drinksToUnits = preferences?.drinks_to_units;

  return useMemo(() => {
    const session = DSUtils.getLastSession(drinkingSessionData);
    if (!session) {
      return null;
    }
    return {
      when: formatDistanceToNow(new Date(session.start_time), {
        addSuffix: true,
      }),
      units: formatUnits(
        DSUtils.calculateTotalUnits(session.drinks, drinksToUnits),
      ),
      dateString: timestampToDateString(session.start_time),
    };
  }, [drinkingSessionData, drinksToUnits]);
}

export default useLastSession;
export type {LastSessionView};
