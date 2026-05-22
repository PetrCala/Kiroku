import {
  eachDayOfInterval,
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {DayRollup, WeekRollup} from '@libs/Statistics/types';

type SelectWeeklyBarsOptions = {
  asOfDate: Date;
  timezone: SelectedTimezone;
  /** Default: 8. */
  weeks?: number;
  /** 0 = Sunday, 1 = Monday. Default: 1 (Monday — ISO). */
  weekStartsOn?: 0 | 1;
};

type SelectWeeklyBarsResult = {
  bars: WeekRollup[];
  /** 25th and 75th percentile of the weekly totalSdu values. */
  band: {p25: number; p75: number};
};

/**
 * Compute weekly bars for the last N weeks ending on `asOfDate`'s week,
 * plus the 25/75 percentile band for the Whoop-style "band of normal"
 * overlay. Bars come back oldest-first.
 */
function selectWeeklyBars(
  rollups: DayRollup[],
  options: SelectWeeklyBarsOptions,
): SelectWeeklyBarsResult {
  const {asOfDate, timezone, weeks = 8, weekStartsOn = 1} = options;
  const localAnchor = toZonedTime(asOfDate, timezone);

  const rollupByDay = new Map<string, DayRollup>();
  for (const r of rollups) {
    rollupByDay.set(r.dateKey, r);
  }
  const userId = rollups[0]?.userId ?? '';

  const bars: WeekRollup[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekDate = subWeeks(localAnchor, i);
    const weekStart = startOfWeek(weekDate, {weekStartsOn});
    const weekEnd = endOfWeek(weekDate, {weekStartsOn});

    let totalSdu = 0;
    let drinksCount = 0;
    let alcoholFreeDays = 0;
    for (const day of eachDayOfInterval({start: weekStart, end: weekEnd})) {
      const r = rollupByDay.get(format(day, 'yyyy-MM-dd'));
      if (r) {
        totalSdu += r.totalSdu;
        drinksCount += r.drinksCount;
      } else {
        alcoholFreeDays += 1;
      }
    }

    bars.push({
      userId,
      isoYear: getISOWeekYear(weekStart),
      isoWeek: getISOWeek(weekStart),
      weekStartDate: format(weekStart, 'yyyy-MM-dd'),
      totalSdu: Number(totalSdu.toFixed(2)),
      drinksCount,
      alcoholFreeDays,
    });
  }

  const sorted = bars.map(b => b.totalSdu).sort((a, b) => a - b);
  return {
    bars,
    band: {
      p25: percentile(sorted, 25),
      p75: percentile(sorted, 75),
    },
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) {
    return Number(sorted[lo].toFixed(2));
  }
  return Number(
    (sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)).toFixed(2),
  );
}

export default selectWeeklyBars;
export type {SelectWeeklyBarsOptions, SelectWeeklyBarsResult};
