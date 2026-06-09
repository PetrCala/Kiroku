import type {Range} from '@components/StatsContextProvider/types';
import type {DrinkEvent} from '@libs/Statistics';
import buildPeriodSummary from './periodSummary';
import type {PeriodSummary, Thresholds} from './periodSummary';
import buildSubPeriodSeries from './subPeriod';
import type {SubPeriodPoint} from './subPeriod';

/** Mirrors the seeded `units_to_colors` default (see User onboarding). */
const DEFAULT_THRESHOLDS: Thresholds = {yellow: 5, orange: 10};

/** The current + previous month summaries and the per-week series. */
type MonthlyStatsCore = {
  current: PeriodSummary;
  previous: PeriodSummary;
  subPeriods: SubPeriodPoint[];
};

/** Full view model consumed by `MonthlyOverviewCard`. */
type MonthlyStats = MonthlyStatsCore & {
  /** True while the underlying event stream is still compiling. */
  isLoading: boolean;
  /**
   * Units from an in-progress live session for the visible month, to overlay
   * on the cached totals. 0 for past months, friends, or no ongoing session.
   */
  liveExtraUnits: number;
};

/**
 * Compute the current + previous calendar-month summaries and the per-week
 * sub-period series for `year`/`month` (1-based) from a pre-filtered event
 * stream. Pure — shared by the home (`useHomeStats`) and profile
 * (`useUserMonthlyStats`) hooks so both screens stay in sync.
 */
function buildMonthlyStats(
  events: readonly DrinkEvent[],
  year: number,
  month: number,
  now: Date,
  thresholds: Thresholds,
): MonthlyStatsCore {
  // `month` is 1-based; `new Date(year, monthIndex, 0)` resolves to the last
  // day of the prior month, and JS normalises negative month indices (so
  // month-2 in January rolls back into the previous year).
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const prevStart = new Date(year, month - 2, 1);
  const prevEnd = new Date(year, month - 1, 0, 23, 59, 59, 999);

  const current = buildPeriodSummary(
    events,
    monthStart,
    monthEnd,
    now,
    thresholds,
  );
  const previous = buildPeriodSummary(
    events,
    prevStart,
    prevEnd,
    now,
    thresholds,
  );

  // A month preset buckets the series by ISO week — one bar per week.
  const monthRange: Range = {
    start: monthStart,
    end: monthEnd,
    preset: 'M',
    offset: 0,
    isPageable: true,
    canGoPrev: false,
    canGoNext: false,
    isLatest: false,
  };
  const subPeriods = buildSubPeriodSeries(events, monthRange, now);

  return {current, previous, subPeriods};
}

export default buildMonthlyStats;
export {DEFAULT_THRESHOLDS};
export type {MonthlyStats, MonthlyStatsCore};
