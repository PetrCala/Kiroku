import {
  addDays,
  eachWeekOfInterval,
  format,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import CONST from '@src/CONST';

type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * One row in the continuous week-row calendar. Days that fall outside the
 * loaded `[start, end]` window are kept as `null` so the row still has 7
 * positions — the renderer paints blank, untappable cells for those.
 *
 * `monthOfFirstDay` / `yearOfFirstDay` are only populated when this week
 * contains the 1st of a month, which is the anchor the side rail uses to
 * place month labels.
 */
type WeekRow = {
  /** ISO date for the week's start day (the day matching `firstDay`). */
  weekStart: DateString;
  /** Seven date strings or null (out of range). Index 0 = `firstDay`. */
  days: Array<DateString | null>;
  /** True if any day in the week is the 1st of a month. */
  isFirstWeekOfMonth: boolean;
  /** Calendar month (0-11) of the day-1 cell, if `isFirstWeekOfMonth`. */
  monthOfFirstDay?: number;
  /** Calendar year of the day-1 cell, if `isFirstWeekOfMonth`. */
  yearOfFirstDay?: number;
};

type BuildWeekRowsArgs = {
  /** Earliest day to include (inclusive). */
  start: Date;
  /** Latest day to include (inclusive). */
  end: Date;
  /** Day index that opens each row; defaults to `CONST.WEEK_STARTS_ON`. */
  weekStartsOn?: WeekStartDay;
};

/**
 * Build a continuous list of week rows that span `[start, end]`.
 *
 * Each row is exactly 7 cells wide. Cells outside the range are `null`,
 * which lets the renderer pad the first/last week without breaking the grid.
 * Returned rows are chronological (earliest → latest).
 */
function buildWeekRows({
  start,
  end,
  weekStartsOn = CONST.WEEK_STARTS_ON,
}: BuildWeekRowsArgs): WeekRow[] {
  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);
  if (normalizedStart > normalizedEnd) {
    return [];
  }

  const weekStarts = eachWeekOfInterval(
    {start: normalizedStart, end: normalizedEnd},
    {weekStartsOn},
  );

  return weekStarts.map(weekStart => {
    const days: Array<DateString | null> = [];
    let isFirstWeekOfMonth = false;
    let monthOfFirstDay: number | undefined;
    let yearOfFirstDay: number | undefined;

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const inRange = isWithinInterval(day, {
        start: normalizedStart,
        end: normalizedEnd,
      });
      if (!inRange) {
        days.push(null);
        continue;
      }
      days.push(format(day, CONST.DATE.FNS_FORMAT_STRING) as DateString);
      if (day.getDate() === 1) {
        isFirstWeekOfMonth = true;
        monthOfFirstDay = day.getMonth();
        yearOfFirstDay = day.getFullYear();
      }
    }

    return {
      weekStart: format(weekStart, CONST.DATE.FNS_FORMAT_STRING) as DateString,
      days,
      isFirstWeekOfMonth,
      monthOfFirstDay,
      yearOfFirstDay,
    };
  });
}

export default buildWeekRows;
export type {WeekRow};
