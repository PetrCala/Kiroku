import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMilliseconds,
  subMonths,
  subWeeks,
  subYears,
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
  /**
   * Period offset: `0` = current period, negative = N whole periods in the
   * past. Ignored for `All` and `Custom` (not pageable).
   */
  offset?: number;
  /** Required when `preset === 'Custom'`. */
  customStart?: Date;
  /** Required when `preset === 'Custom'`. */
  customEnd?: Date;
  /** Required when `preset === 'All'`. Falls back to `startOfDay(now)`. */
  earliestSessionAt?: Date;
};

/**
 * Pure mapping from a preset (+ "now" snapshot + period offset) to an
 * inclusive `[start, end]` window.
 *
 * At `offset === 0` the result is identical to the legacy behaviour: `start`
 * is the beginning of the relevant calendar unit and `end` is `endOfDay(now)`,
 * so the current window covers everything logged today ("to date").
 *
 * At `offset < 0` the window is the *full* prior period N steps back
 * (e.g. an entire previous month/week/year), contiguous with and not
 * overlapping the current window.
 *
 * `All` and `Custom` ignore `offset`. `Custom` returns the caller's stored
 * range verbatim; falls back to the current month when no range has been set.
 */
function derivePresetRange(params: DeriveParams): DerivedRange {
  const {
    preset,
    now,
    offset = 0,
    customStart,
    customEnd,
    earliestSessionAt,
  } = params;
  const end = endOfDay(now);
  const weekStartsOn = DateUtils.getWeekStartsOn();
  const steps = -offset;

  switch (preset) {
    case 'W': {
      if (offset === 0) {
        return {start: startOfWeek(now, {weekStartsOn}), end};
      }
      const base = subWeeks(now, steps);
      return {
        start: startOfWeek(base, {weekStartsOn}),
        end: endOfWeek(base, {weekStartsOn}),
      };
    }
    case 'M': {
      if (offset === 0) {
        return {start: startOfMonth(now), end};
      }
      const base = subMonths(now, steps);
      return {start: startOfMonth(base), end: endOfMonth(base)};
    }
    case '6M': {
      if (offset === 0) {
        return {start: startOfDay(subMonths(now, 6)), end};
      }
      // Trailing 6-month window shifted back by 6·steps months, ending the
      // instant before the next (more recent) window begins.
      return {
        start: startOfDay(subMonths(now, 6 * (steps + 1))),
        end: subMilliseconds(startOfDay(subMonths(now, 6 * steps)), 1),
      };
    }
    case 'Y': {
      if (offset === 0) {
        return {start: startOfYear(now), end};
      }
      const base = subYears(now, steps);
      return {start: startOfYear(base), end: endOfYear(base)};
    }
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
