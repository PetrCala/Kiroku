import {useMemo} from 'react';
import {addDays, endOfWeek, format, isSameDay, startOfWeek} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import type {
  DrinkingSessionArray,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';

type WeekDay = {
  date: Date;
  units: number;
  isToday: boolean;
  isFuture: boolean;
};

type WeekSummary = {
  sessions: number;
  units: number;
  quietDays: number;
};

type HomeWeekStats = {
  days: WeekDay[];
  summary: WeekSummary;
};

const EMPTY_WEEK: HomeWeekStats = {
  days: [],
  summary: {sessions: 0, units: 0, quietDays: 0},
};

function parseFirstDayOfWeek(raw: string | undefined): 0 | 1 {
  // date-fns' weekStartsOn is 0–6. Kiroku currently only ships Mon/Sun; default Monday.
  if (raw === '0' || raw === 'sunday' || raw === 'Sunday') {
    return 0;
  }
  return 1;
}

/**
 * Day-by-day breakdown of the current week for the "This week" home card.
 *
 * Reuses `convertUnitsToColors` so the day-pill colors match the main calendar's
 * yellow→orange ramp exactly. Future days are flagged (`isFuture`) so the view
 * renders them transparently rather than as "0".
 */
function useHomeWeekStats(
  drinkingSessionData: DrinkingSessionList | undefined,
  preferences: Preferences | undefined,
): HomeWeekStats {
  return useMemo(() => {
    if (!drinkingSessionData || !preferences) {
      return EMPTY_WEEK;
    }
    const tz = CONST.DEFAULT_TIME_ZONE.selected;
    const today = toZonedTime(new Date(), tz);
    const weekStartsOn = parseFirstDayOfWeek(preferences.first_day_of_week);
    const weekStart = startOfWeek(today, {weekStartsOn});
    const weekEnd = endOfWeek(today, {weekStartsOn});

    // Bucket sessions to local day keys.
    const unitsByDay = new Map<string, number>();
    const sessionsByDay = new Map<string, number>();
    let weekSessions = 0;
    let weekUnits = 0;

    const sessionsArray: DrinkingSessionArray =
      Object.values(drinkingSessionData);
    sessionsArray.forEach(session => {
      const sessionTz = session.timezone ?? tz;
      const zoned = toZonedTime(session.start_time, sessionTz);
      if (zoned < weekStart || zoned > weekEnd) {
        return;
      }
      const key = format(zoned, CONST.DATE.FNS_FORMAT_STRING);
      const sessionUnits = DSUtils.calculateTotalUnits(
        session.drinks,
        preferences.drinks_to_units,
      );
      unitsByDay.set(key, (unitsByDay.get(key) ?? 0) + sessionUnits);
      sessionsByDay.set(key, (sessionsByDay.get(key) ?? 0) + 1);
      weekSessions += 1;
      weekUnits += sessionUnits;
    });

    const days: WeekDay[] = Array.from({length: 7}, (_, i) => {
      const date = addDays(weekStart, i);
      const key = format(date, CONST.DATE.FNS_FORMAT_STRING);
      const units = unitsByDay.get(key) ?? 0;
      const isFuture = date > today && !isSameDay(date, today);
      return {
        date,
        units,
        isToday: isSameDay(date, today),
        isFuture,
      };
    });

    // Quiet days = elapsed (up to & including today) days with zero units.
    // Future days don't count either way — we only know quiet *so far*.
    let quietDays = 0;
    days.forEach(d => {
      if (d.isFuture) {
        return;
      }
      if (d.units === 0) {
        quietDays += 1;
      }
    });

    return {
      days,
      summary: {
        sessions: weekSessions,
        units: weekUnits,
        quietDays,
      },
    };
  }, [drinkingSessionData, preferences]);
}

export default useHomeWeekStats;
export type {HomeWeekStats, WeekDay, WeekSummary};
