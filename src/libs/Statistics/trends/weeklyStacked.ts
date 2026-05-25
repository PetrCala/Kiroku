import aggregate from '@libs/Statistics/aggregate';
import {
  byDrinkKey,
  byIsoWeek,
  composeBuckets,
  COMPOSITE_KEY_SEP,
} from '@libs/Statistics/bucketers';
import {sumUnits} from '@libs/Statistics/reducers';
import {dateRange, drinkTypeSubset} from '@libs/Statistics/filters';
import type {DrinkEvent} from '@libs/Statistics/types';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import {weekKeysInRange} from './weeks';

type StackedWeek = {
  isoWeek: string;
  byKey: Record<DrinkKey, number>;
};

/**
 * Weekly drink-type breakdown for the inclusive window `[start, end]`.
 *
 *   - `drinkTypeFilter` empty Set ⇒ all keys in `allKeys` are tracked.
 *   - Otherwise only keys in the filter are tracked.
 *   - Weeks with zero events for a tracked key get `0` for that key.
 *
 * The returned array is index-aligned with {@link weekKeysInRange}, so the
 * chart layer can iterate by row index and read each stacked layer by name.
 */
function buildWeeklyStackedSeries(
  events: DrinkEvent[],
  start: Date,
  end: Date,
  drinkTypeFilter: ReadonlySet<DrinkKey>,
  allKeys: readonly DrinkKey[],
): {weeks: StackedWeek[]; trackedKeys: readonly DrinkKey[]} {
  const trackedKeys =
    drinkTypeFilter.size === 0
      ? allKeys
      : allKeys.filter(k => drinkTypeFilter.has(k));

  const labels = weekKeysInRange(start, end);

  const baseFilter = dateRange(start.getTime(), end.getTime());
  const filter =
    drinkTypeFilter.size === 0
      ? baseFilter
      : (event: DrinkEvent) =>
          baseFilter(event) && drinkTypeSubset(drinkTypeFilter)(event);

  const composite = aggregate(
    events,
    composeBuckets(byIsoWeek, byDrinkKey),
    sumUnits,
    filter,
  );

  // Zero-fill skeleton.
  const byWeek = new Map<string, Record<DrinkKey, number>>();
  for (const week of labels) {
    const row = {} as Record<DrinkKey, number>;
    for (const key of trackedKeys) {
      row[key] = 0;
    }
    byWeek.set(week, row);
  }

  composite.forEach((units, compositeKey) => {
    const idx = compositeKey.indexOf(COMPOSITE_KEY_SEP);
    if (idx === -1) {
      return;
    }
    const week = compositeKey.slice(0, idx);
    const key = compositeKey.slice(idx + 1) as DrinkKey;
    const row = byWeek.get(week);
    if (!row || !(key in row)) {
      return;
    }
    row[key] = units;
  });

  const weeks: StackedWeek[] = labels.map(isoWeek => ({
    isoWeek,
    byKey: byWeek.get(isoWeek) ?? ({} as Record<DrinkKey, number>),
  }));

  return {weeks, trackedKeys};
}

export default buildWeeklyStackedSeries;
export type {StackedWeek};
