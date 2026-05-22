import {
  addDays,
  eachWeekOfInterval,
  endOfMonth,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import CONST from '@src/CONST';

type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * One row in a month's grid. Always exactly 7 cells; days that fall outside
 * the month *or* outside the loaded `[start, end]` range are `null`, which
 * the renderer paints as a blank cell.
 */
type MonthWeek = {
  /** ISO date for the first day of the week-strip (used as a stable key). */
  key: DateString;
  /** Seven entries, index 0 = `firstDay`. `null` = blank cell. */
  days: Array<DateString | null>;
};

/**
 * A self-contained mini-grid for one calendar month. The label header on
 * top of the fullscreen calendar is rendered from `year`/`month`; the
 * underlying day cells come from `weeks`.
 */
type MonthSection = {
  /** Calendar year. */
  year: number;
  /** Calendar month (0-11). */
  month: number;
  /** 4–6 rows of 7 cells each. */
  weeks: MonthWeek[];
};

type BuildMonthSectionsArgs = {
  /** Earliest day to include (inclusive). */
  start: Date;
  /** Latest day to include (inclusive). */
  end: Date;
  /** Day index that opens each row; defaults to `CONST.WEEK_STARTS_ON`. */
  weekStartsOn?: WeekStartDay;
};

/**
 * Build self-contained month sections covering `[start, end]`.
 *
 * Each month contributes the weeks that overlap any of its days, with cells
 * outside the month *or* outside the loaded range nulled out. The renderer
 * inserts a section label between sections — months never bleed into each
 * other.
 *
 * Returned chronologically (earliest → latest).
 */
function buildMonthSections({
  start,
  end,
  weekStartsOn = CONST.WEEK_STARTS_ON,
}: BuildMonthSectionsArgs): MonthSection[] {
  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);
  if (normalizedStart > normalizedEnd) {
    return [];
  }

  const sections: MonthSection[] = [];
  // Walk month-by-month from the start's month to the end's month.
  let cursor = startOfMonth(normalizedStart);
  const lastMonth = startOfMonth(normalizedEnd);

  while (cursor <= lastMonth) {
    const monthStart = cursor;
    const monthEnd = endOfMonth(cursor);
    const monthIndex = monthStart.getMonth();
    const monthYear = monthStart.getFullYear();

    // Weeks (`firstDay`-aligned) that contain any day of this month.
    const weekStarts = eachWeekOfInterval(
      {start: monthStart, end: monthEnd},
      {weekStartsOn},
    );

    const weeks: MonthWeek[] = weekStarts
      .map(weekStart => {
        const days: Array<DateString | null> = [];
        for (let i = 0; i < 7; i++) {
          const day = addDays(weekStart, i);
          const inMonth = day.getMonth() === monthIndex;
          const inRange = isWithinInterval(day, {
            start: normalizedStart,
            end: normalizedEnd,
          });
          if (!inMonth || !inRange) {
            days.push(null);
          } else {
            days.push(format(day, CONST.DATE.FNS_FORMAT_STRING) as DateString);
          }
        }
        return {
          key: format(weekStart, CONST.DATE.FNS_FORMAT_STRING) as DateString,
          days,
        };
      })
      // Drop fully-blank rows. The only ones that can occur:
      //   - trailing weeks past `end` in the last loaded month (e.g. when
      //     today is mid-month and the natural last week sits entirely in
      //     the future), and
      //   - leading weeks before `start` in the first loaded month.
      // Partial rows containing at least one in-range day are kept so the
      // 7-cell grid stays aligned with the day-name strip.
      .filter(week => week.days.some(d => d !== null));

    if (weeks.length > 0) {
      sections.push({year: monthYear, month: monthIndex, weeks});
    }

    // Advance one month.
    cursor = startOfMonth(addDays(monthEnd, 1));
  }

  return sections;
}

export default buildMonthSections;
export type {MonthSection, MonthWeek};
