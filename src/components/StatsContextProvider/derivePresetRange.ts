import {
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';
import DateUtils from '@libs/DateUtils';
import type {RangePreset} from '@src/types/onyx/StatisticsFilters';

type DerivedRange = {
  start: Date;
  end: Date;
};

type DeriveParams = {
  preset: RangePreset;
  now: Date;
  /** Required when `preset === 'Custom'`. */
  customStart?: Date;
  /** Required when `preset === 'Custom'`. */
  customEnd?: Date;
  /** Required when `preset === 'All'`. Falls back to `startOfDay(now)`. */
  earliestSessionAt?: Date;
};

/**
 * Pure mapping from a preset (+ "now" snapshot) to an inclusive
 * `[start, end]` window. `start` is the beginning of the relevant calendar
 * unit; `end` is `endOfDay(now)` so the window covers everything logged
 * today.
 *
 * `Custom` returns the caller's stored range verbatim; falls back to the
 * current month when no range has been set yet.
 */
function derivePresetRange(params: DeriveParams): DerivedRange {
  const {preset, now, customStart, customEnd, earliestSessionAt} = params;
  const end = endOfDay(now);

  switch (preset) {
    case 'W':
      return {
        start: startOfWeek(now, {weekStartsOn: DateUtils.getWeekStartsOn()}),
        end,
      };
    case 'M':
      return {start: startOfMonth(now), end};
    case '6M':
      return {start: startOfDay(subMonths(now, 6)), end};
    case 'Y':
      return {start: startOfYear(now), end};
    case 'All':
      return {start: earliestSessionAt ?? startOfDay(now), end};
    case 'Custom':
    default:
      return {
        start: customStart ?? startOfMonth(now),
        end: customEnd ?? end,
      };
  }
}

export default derivePresetRange;
export type {DerivedRange, DeriveParams};
