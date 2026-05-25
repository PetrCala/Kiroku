import aggregate from '@libs/Statistics/aggregate';
import {byIsoWeek} from '@libs/Statistics/bucketers';
import {sumUnits} from '@libs/Statistics/reducers';
import {dateRange} from '@libs/Statistics/filters';
import type {DrinkEvent} from '@libs/Statistics/types';
import {weekKeysInRange} from './weeks';

type WeeklyUnitsPoint = {
  isoWeek: string;
  units: number;
};

/**
 * Gap-filled weekly-units series for the inclusive window `[start, end]`.
 * Every ISO week the window touches is represented exactly once — weeks with
 * no events contribute `0`. The returned array is index-aligned with
 * {@link weekKeysInRange}, which is what makes the "vs previous period"
 * comparison series stack neatly underneath the current series.
 */
function buildWeeklyUnits(
  events: DrinkEvent[],
  start: Date,
  end: Date,
): WeeklyUnitsPoint[] {
  const labels = weekKeysInRange(start, end);
  const byWeek = aggregate(
    events,
    byIsoWeek,
    sumUnits,
    dateRange(start.getTime(), end.getTime()),
  );
  return labels.map(isoWeek => ({
    isoWeek,
    units: byWeek.get(isoWeek) ?? 0,
  }));
}

export default buildWeeklyUnits;
export type {WeeklyUnitsPoint};
