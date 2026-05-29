import {format, parseISO} from 'date-fns';
import aggregate from '@libs/Statistics/aggregate';
import type {Bucketer} from '@libs/Statistics/aggregate';
import {byDay, byIsoWeek, byMonth, byYear} from '@libs/Statistics/bucketers';
import {dateRange} from '@libs/Statistics/filters';
import {sumUnits} from '@libs/Statistics/reducers';
import {weekKeysInRange} from '@libs/Statistics/trends';
import type {DrinkEvent} from '@libs/Statistics/types';
import type {Range} from '@components/StatsContextProvider/types';
import {dayKeysInRange, monthKeysInRange, yearKeysInRange} from './keys';

type Granularity = 'day' | 'week' | 'month' | 'year';

type SubPeriodPoint = {
  /** Short axis label, e.g. `Mon`, `W22`, `May`, `2026`. */
  label: string;
  units: number;
};

const MS_PER_DAY = 86_400_000;

/**
 * Choose the sub-period granularity for the texture bar-list / hero sparkline
 * from the selected range, so a Week shows days, a Month shows weeks, etc.
 * `Custom` falls back to the window span.
 */
function pickGranularity(range: Range): Granularity {
  switch (range.preset) {
    case 'W':
      return 'day';
    case 'M':
      return 'week';
    case '6M':
    case 'Y':
      return 'month';
    case 'All':
      return 'year';
    case 'Custom':
    default: {
      const days = Math.round(
        (range.end.getTime() - range.start.getTime()) / MS_PER_DAY,
      );
      if (days <= 14) {
        return 'day';
      }
      if (days <= 92) {
        return 'week';
      }
      if (days <= 366 * 3) {
        return 'month';
      }
      return 'year';
    }
  }
}

function labelFor(granularity: Granularity, key: string): string {
  switch (granularity) {
    case 'day':
      return format(parseISO(key), 'EEE');
    case 'week':
      // `RRRR-'W'II` → `W22`.
      return key.slice(5);
    case 'month':
      return format(parseISO(`${key}-01`), 'MMM');
    case 'year':
    default:
      return key;
  }
}

function bucketerFor(granularity: Granularity): Bucketer<string> {
  switch (granularity) {
    case 'day':
      return byDay;
    case 'week':
      return byIsoWeek;
    case 'month':
      return byMonth;
    case 'year':
    default:
      return byYear;
  }
}

function keysFor(granularity: Granularity, start: Date, end: Date): string[] {
  switch (granularity) {
    case 'day':
      return dayKeysInRange(start, end);
    case 'week':
      return weekKeysInRange(start, end);
    case 'month':
      return monthKeysInRange(start, end);
    case 'year':
    default:
      return yearKeysInRange(start, end);
  }
}

/**
 * Gap-filled per-sub-period units series for `range`, clamped to `now`. Drives
 * both the hero sparkline and the texture bar-list off one bucketing so they
 * always agree on granularity.
 */
function buildSubPeriodSeries(
  events: readonly DrinkEvent[],
  range: Range,
  now: Date,
): SubPeriodPoint[] {
  const startMs = range.start.getTime();
  const effectiveEndMs = Math.min(range.end.getTime(), now.getTime());
  if (effectiveEndMs < startMs) {
    return [];
  }
  const effectiveEnd = new Date(effectiveEndMs);
  const granularity = pickGranularity(range);
  const keys = keysFor(granularity, range.start, effectiveEnd);
  const byBucket = aggregate(
    events,
    bucketerFor(granularity),
    sumUnits,
    dateRange(startMs, effectiveEndMs),
  );
  return keys.map(key => ({
    label: labelFor(granularity, key),
    units: byBucket.get(key) ?? 0,
  }));
}

export default buildSubPeriodSeries;
export {pickGranularity};
export type {Granularity, SubPeriodPoint};
