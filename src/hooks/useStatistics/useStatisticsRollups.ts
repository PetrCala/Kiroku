import {useMemo} from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {buildDayRollups, buildSessionCountsByDay} from '@libs/Statistics';
import type {DayRollup} from '@libs/Statistics';
import CONST from '@src/CONST';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

type UseStatisticsRollupsReturn = {
  /** Day-level rollups for the current user, sorted ascending by dateKey. */
  data: DayRollup[];
  /** Session counts bucketed by start_time in the session's timezone. */
  sessionCountsByDay: Record<string, number>;
  /** Viewer timezone. Used as a fallback when a session has none. */
  timezone: SelectedTimezone;
  /** Week start derived from `Preferences.first_day_of_week`. */
  weekStartsOn: 0 | 1;
  userId: UserID;
  /** True while Onyx/Firebase data is hydrating. */
  isLoading: boolean;
  /** True once loaded if the user has no rollup-producing sessions in scope. */
  isEmpty: boolean;
};

/**
 * Primitive statistics hook. Reads the current user's sessions, preferences,
 * and timezone from the existing DatabaseData context and produces day
 * rollups plus session counts. Selector hooks (`useKpis`,
 * `useCalendarHeatmap`, `useWeeklyBars`) wrap this one.
 *
 * Both the rollups and the session counts are memoized on their inputs — the
 * underlying Onyx state ships stable refs, so the memos stay hot across
 * unrelated re-renders.
 */
function useStatisticsRollups(): UseStatisticsRollupsReturn {
  const {auth} = useFirebase();
  const userId: UserID = auth?.currentUser?.uid ?? '';
  const {drinkingSessionData, preferences, userData} = useDatabaseData();

  const drinksToUnits = preferences?.drinks_to_units;
  const timezone: SelectedTimezone =
    userData?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected;
  const weekStartsOn: 0 | 1 =
    preferences?.first_day_of_week === 'Sunday' ? 0 : 1;

  const isLoading = !drinksToUnits || !drinkingSessionData;

  const data = useMemo<DayRollup[]>(() => {
    if (isLoading || !drinkingSessionData || !drinksToUnits) {
      return [];
    }
    return buildDayRollups(
      drinkingSessionData,
      drinksToUnits,
      timezone,
      userId,
    );
  }, [isLoading, drinkingSessionData, drinksToUnits, timezone, userId]);

  const sessionCountsByDay = useMemo<Record<string, number>>(() => {
    if (isLoading || !drinkingSessionData) {
      return {};
    }
    return buildSessionCountsByDay(drinkingSessionData, timezone);
  }, [isLoading, drinkingSessionData, timezone]);

  return {
    data,
    sessionCountsByDay,
    timezone,
    weekStartsOn,
    userId,
    isLoading,
    isEmpty: !isLoading && data.length === 0,
  };
}

export default useStatisticsRollups;
export type {UseStatisticsRollupsReturn};
