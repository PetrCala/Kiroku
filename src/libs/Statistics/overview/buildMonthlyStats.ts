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
  /**
   * True when the viewed month is the in-progress current calendar month, so
   * the previous window is clamped to the same chunk and the comparison is
   * captioned "month to date" (vs the full-month "vs last month").
   */
  isCurrentMonth: boolean;
  /**
   * Whether a month-over-month comparison is meaningful: the current period has
   * elapsed days (not a future month) AND the previous window overlaps the
   * user's tracking history (a real baseline exists). False ⇒ the card renders
   * blank, reserved comparison space instead of a misleading delta.
   */
  comparisonAvailable: boolean;
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
  /**
   * The viewed user's first-activity floor in ms (`UserData.earliest_session_at`).
   * Used to decide whether a prior-month baseline exists. Falls back to the
   * earliest event when undefined (legacy accounts before the backfill).
   */
  earliestSessionAt?: number,
): MonthlyStatsCore {
  // `month` is 1-based; `new Date(year, monthIndex, 0)` resolves to the last
  // day of the prior month, and JS normalises negative month indices (so
  // month-2 in January rolls back into the previous year).
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const prevStart = new Date(year, month - 2, 1);

  const current = buildPeriodSummary(
    events,
    monthStart,
    monthEnd,
    now,
    thresholds,
  );

  // For the in-progress current month, compare against the *same chunk* of the
  // previous month (e.g. Jun 1–16 vs May 1–16) so a partial month isn't measured
  // against a full one. Past complete months keep the full previous month — their
  // comparison is already fair. `Math.min` with the previous month's real length
  // stops a long month after a short one (Mar 30 vs Feb) overflowing into the
  // wrong month, falling back to the whole short month.
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const prevEnd = isCurrentMonth
    ? new Date(
        year,
        month - 2,
        Math.min(current.elapsedDays, daysInPrevMonth),
        23,
        59,
        59,
        999,
      )
    : new Date(year, month - 1, 0, 23, 59, 59, 999);

  const previous = buildPeriodSummary(
    events,
    prevStart,
    prevEnd,
    now,
    thresholds,
  );

  // The comparison is meaningful only when the current period has elapsed days
  // (not a future month) AND the previous window overlaps the user's tracking
  // history (a real baseline). A genuinely alcohol-free *tracked* month still
  // has a baseline, so its comparison is kept.
  const earliestMs =
    earliestSessionAt ??
    (events.length > 0
      ? events.reduce((min, e) => Math.min(min, e.anchorTs), Infinity)
      : Number.NEGATIVE_INFINITY);
  const comparisonAvailable =
    current.elapsedDays > 0 && prevEnd.getTime() >= earliestMs;

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

  return {current, previous, subPeriods, isCurrentMonth, comparisonAvailable};
}

export default buildMonthlyStats;
export {DEFAULT_THRESHOLDS};
export type {MonthlyStats, MonthlyStatsCore};
