import type {DayRollup} from '@analytics/types';
import DateUtils from '@libs/DateUtils';
import CONST from '@src/CONST';
import {parse, startOfWeek, addDays, isAfter, isBefore} from 'date-fns';

/** * Kpis are the key performance indicators for the analytics.  */
type Kpis = {
  /** The standard drinks units for today. */
  todaySdu: number;

  /** The number of drinks for today. */
  drinksToday: number;

  /** The standard drinks units for the week. */
  weekSdu: number;

  /** The percentage change in standard drinks units from the previous week. */
  weekVsPrevPct?: number; // undefined if no previous week
};

const parseKey = (key: string): Date => {
  return parse(key, CONST.DATE.FNS_FORMAT_STRING, new Date());
};

/**
 * Gets the key performance indicators for the analytics.
 *
 * @param dayRows - The day rollups.
 * @param now - The current date.
 * @returns The key performance indicators.
 */
function getKpis(dayRows: DayRollup[], now: Date = new Date()): Kpis {
  const todayKey = DateUtils.getLocalizedDay(
    now,
    undefined,
    CONST.DATE.FNS_FORMAT_STRING,
  );

  // Get start of week (Monday) in user's timezone
  const startOfWeekDate = startOfWeek(now, {
    weekStartsOn: CONST.WEEK_STARTS_ON,
  });
  const prevWeekStart = addDays(startOfWeekDate, -7);

  const isInRange = (r: DayRollup, start: Date, end: Date): boolean => {
    const dateKey = parseKey(r.dateKey);
    return isAfter(dateKey, start) && isBefore(dateKey, end);
  };

  const todayRow = dayRows.find(r => r.dateKey === todayKey);

  const weekSum = dayRows
    .filter(r => isInRange(r, startOfWeekDate, addDays(startOfWeekDate, 7)))
    .reduce((a, r) => a + r.totalSdu, 0);

  const prevWeekSum = dayRows
    .filter(r => isInRange(r, prevWeekStart, addDays(prevWeekStart, 7)))
    .reduce((a, r) => a + r.totalSdu, 0);

  const weekVsPrevPct =
    prevWeekSum > 0 ? ((weekSum - prevWeekSum) / prevWeekSum) * 100 : undefined;

  return {
    todaySdu: +(todayRow?.totalSdu ?? 0).toFixed(2),
    drinksToday: todayRow?.drinksCount ?? 0,
    weekSdu: +weekSum.toFixed(2),
    weekVsPrevPct:
      weekVsPrevPct !== undefined ? +weekVsPrevPct.toFixed(1) : undefined,
  };
}

export type {Kpis};
export {getKpis};
