import {eachDayOfInterval, endOfMonth, format, startOfMonth} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {DayRollup, HeatmapCell} from '@libs/Statistics/types';

type SelectCalendarHeatmapOptions = {
  /** Any timestamp within the target month. */
  monthAnchor: Date;
  /** Timezone the rollups were built with. */
  timezone: SelectedTimezone;
};

/**
 * Intensity buckets for the v1 heatmap. Thresholds are SDU cutoffs and
 * are intentionally hardcoded — v2 may move them to Preferences so users
 * can recalibrate the ramp.
 */
function intensityFor(sdu: number): 0 | 1 | 2 | 3 | 4 {
  if (sdu <= 0) {
    return 0;
  }
  if (sdu <= 1) {
    return 1;
  }
  if (sdu <= 3) {
    return 2;
  }
  if (sdu <= 6) {
    return 3;
  }
  return 4;
}

/**
 * Build one HeatmapCell per day of the month containing `monthAnchor`.
 * Days with no rollup produce a cell with totalSdu=0 / intensity=0.
 */
function selectCalendarHeatmap(
  rollups: DayRollup[],
  options: SelectCalendarHeatmapOptions,
): HeatmapCell[] {
  const localAnchor = toZonedTime(options.monthAnchor, options.timezone);
  const start = startOfMonth(localAnchor);
  const end = endOfMonth(localAnchor);

  const rollupByDay = new Map<string, DayRollup>();
  for (const r of rollups) {
    rollupByDay.set(r.dateKey, r);
  }

  return eachDayOfInterval({start, end}).map(day => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const sdu = rollupByDay.get(dateKey)?.totalSdu ?? 0;
    return {dateKey, totalSdu: sdu, intensity: intensityFor(sdu)};
  });
}

export default selectCalendarHeatmap;
export type {SelectCalendarHeatmapOptions};
