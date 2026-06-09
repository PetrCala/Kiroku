import {useMemo} from 'react';
import type {DateData} from 'react-native-calendars';
import {resolveWeekStart} from '@hooks/useStatistics/useDrinkEvents';
import {buildDrinkEvents} from '@libs/Statistics';
import {buildMonthlyStats, DEFAULT_THRESHOLDS} from '@libs/Statistics/overview';
import type {MonthlyStats} from '@libs/Statistics/overview';
import CONST from '@src/CONST';
import type {
  DrinkingSessionList,
  Preferences,
  UserDrinkingSessionsList,
} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

type UseUserMonthlyStatsParams = {
  userID: UserID;
  visibleDate: DateData;
  /** That user's windowed sessions (e.g. from `useDrinkingSessionsFetch`). */
  drinkingSessionData: DrinkingSessionList | undefined;
  /** That user's preferences (drinks→units, thresholds, week start). */
  preferences: Preferences | undefined;
  /** That user's selected timezone. */
  timezone: SelectedTimezone | undefined;
  isLoading: boolean;
};

/**
 * Monthly stats for an arbitrary user (self or friend), so
 * `MonthlyOverviewCard` can be reused on the profile screen. Builds the event
 * stream from the caller-supplied sessions + that user's preferences/timezone
 * (the caller owns the fetching), then reuses `buildMonthlyStats`. No live
 * overlay — a profile is a historical view (`liveExtraUnits` is always 0).
 */
function useUserMonthlyStats({
  userID,
  visibleDate,
  drinkingSessionData,
  preferences,
  timezone,
  isLoading,
}: UseUserMonthlyStatsParams): MonthlyStats {
  const drinksToUnits = preferences?.drinks_to_units;
  const weekStart = resolveWeekStart(preferences?.first_day_of_week);
  const resolvedTimezone = timezone ?? CONST.DEFAULT_TIME_ZONE.selected;

  const thresholds = useMemo(
    () => preferences?.units_to_colors ?? DEFAULT_THRESHOLDS,
    [preferences?.units_to_colors],
  );

  // Snapshot `now` once per mount so the current/previous clamps agree.
  const now = useMemo(() => new Date(), []);

  const events = useMemo(() => {
    const userSessions: UserDrinkingSessionsList | undefined =
      drinkingSessionData ? {[userID]: drinkingSessionData} : undefined;
    return buildDrinkEvents(
      userSessions,
      drinksToUnits,
      CONST.DRINK_DEFAULTS,
      resolvedTimezone,
      weekStart,
    );
  }, [drinkingSessionData, userID, drinksToUnits, resolvedTimezone, weekStart]);

  const {year, month} = visibleDate;
  const {current, previous, subPeriods} = useMemo(
    () => buildMonthlyStats(events, year, month, now, thresholds),
    [events, year, month, now, thresholds],
  );

  return {isLoading, current, previous, subPeriods, liveExtraUnits: 0};
}

export default useUserMonthlyStats;
