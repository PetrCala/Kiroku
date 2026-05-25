import {useMemo} from 'react';
import type {DateData} from 'react-native-calendars';
import {eachDayOfInterval, endOfMonth, format, startOfMonth} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import {calculateThisMonthUnits, timestampToDate} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import type {
  DrinkingSessionArray,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';

type HomeMonthStats = {
  drinkingSessionsCount: number;
  unitsConsumed: number;
  alcoholFreeDays: number;
};

const EMPTY_STATS: HomeMonthStats = {
  drinkingSessionsCount: 0,
  unitsConsumed: 0,
  alcoholFreeDays: 0,
};

/**
 * Compute the home-screen month statistics: sessions logged, total units, and
 * alcohol-free days for the visible month.
 *
 * Alcohol-free days clamps the day interval to `min(monthEnd, today)` so we
 * never count future days as alcohol-free — fixes the inflation bug called
 * out in `mockups/DIRECTION_REVIEW.md` §3.
 */
function useHomeMonthStats(
  visibleDate: DateData,
  drinkingSessionData: DrinkingSessionList | undefined,
  preferences: Preferences | undefined,
): HomeMonthStats {
  const drinksToUnits = preferences?.drinks_to_units;

  return useMemo(() => {
    if (!drinksToUnits || !drinkingSessionData) {
      return EMPTY_STATS;
    }
    const sessionsArray: DrinkingSessionArray =
      Object.values(drinkingSessionData);
    const monthDate = timestampToDate(visibleDate.timestamp);
    const monthSessions = DSUtils.getSingleMonthDrinkingSessions(
      monthDate,
      sessionsArray,
      false,
    );
    const unitsConsumed = calculateThisMonthUnits(
      visibleDate,
      sessionsArray,
      drinksToUnits,
    );

    const tz = CONST.DEFAULT_TIME_ZONE.selected;
    const today = toZonedTime(new Date(), tz);
    const monthStart = startOfMonth(toZonedTime(monthDate, tz));
    const monthEnd = endOfMonth(monthStart);

    // Future month: nothing has happened yet — render 0, not days-in-month.
    if (monthStart > today) {
      return {
        drinkingSessionsCount: monthSessions.length,
        unitsConsumed,
        alcoholFreeDays: 0,
      };
    }

    const intervalEnd = monthEnd < today ? monthEnd : today;
    const elapsedDays = eachDayOfInterval({
      start: monthStart,
      end: intervalEnd,
    });

    const drinkDayKeys = new Set<string>();
    monthSessions.forEach(session => {
      const sessionTz = session.timezone ?? tz;
      const zoned = toZonedTime(session.start_time, sessionTz);
      drinkDayKeys.add(format(zoned, CONST.DATE.FNS_FORMAT_STRING));
    });

    let alcoholFreeDays = 0;
    elapsedDays.forEach(day => {
      const key = format(day, CONST.DATE.FNS_FORMAT_STRING);
      if (!drinkDayKeys.has(key)) {
        alcoholFreeDays += 1;
      }
    });

    return {
      drinkingSessionsCount: monthSessions.length,
      unitsConsumed,
      alcoholFreeDays,
    };
  }, [drinkingSessionData, visibleDate, drinksToUnits]);
}

export default useHomeMonthStats;
export type {HomeMonthStats};
