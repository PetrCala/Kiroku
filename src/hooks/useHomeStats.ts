import {useMemo} from 'react';
import type {DateData} from 'react-native-calendars';
import type {DrinkBreakdownItem} from '@components/Charts/DrinkBreakdown';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useDrinkEvents from '@hooks/useStatistics/useDrinkEvents';
import {aggregate, byDrinkKey, dateRange, sumUnits} from '@libs/Statistics';
import {buildPeriodSummary} from '@libs/Statistics/overview';
import type {PeriodSummary, Thresholds} from '@libs/Statistics/overview';
import {DRINK_KEY_ORDER} from '@screens/Statistics/tabs/breakdown/drinkKeyColors';

/** Mirrors the seeded `units_to_colors` default (see User onboarding). */
const DEFAULT_THRESHOLDS: Thresholds = {yellow: 5, orange: 10};

type HomeStats = {
  /** True while the underlying event stream is still compiling. */
  isLoading: boolean;
  /** Scorecard metrics for the visible calendar month. */
  current: PeriodSummary;
  /** Same metrics for the month before, for "vs last month" deltas. */
  previous: PeriodSummary;
  /** Units per drink type for the visible month, ordered, zeros omitted. */
  drinkBreakdown: DrinkBreakdownItem[];
};

/**
 * Home-screen stats derived from the Statistics v2 event stream for the
 * calendar month the user is currently viewing (`visibleDate`), plus its
 * previous-month twin for deltas and a per-drink-type composition of the
 * month's units. Thresholds come from the user's `units_to_colors`
 * preference so "alcohol-free" means the same here as on the calendars and
 * the Statistics screen.
 */
function useHomeStats(visibleDate: DateData): HomeStats {
  const {events, isLoading} = useDrinkEvents();
  const {preferences} = useDatabaseData();

  const thresholds = useMemo(
    () => preferences?.units_to_colors ?? DEFAULT_THRESHOLDS,
    [preferences?.units_to_colors],
  );

  // Snapshot `now` once per mount so the current/previous clamps agree.
  const now = useMemo(() => new Date(), []);

  // `DateData.month` is 1-based; `new Date(year, monthIndex, 0)` resolves to
  // the last day of the prior month, and JS normalises negative month indices
  // (so month-2 in January rolls back into the previous year).
  const {year, month} = visibleDate;
  const {monthStart, monthEnd, prevStart, prevEnd} = useMemo(
    () => ({
      monthStart: new Date(year, month - 1, 1),
      monthEnd: new Date(year, month, 0, 23, 59, 59, 999),
      prevStart: new Date(year, month - 2, 1),
      prevEnd: new Date(year, month - 1, 0, 23, 59, 59, 999),
    }),
    [year, month],
  );

  const current = useMemo(
    () => buildPeriodSummary(events, monthStart, monthEnd, now, thresholds),
    [events, monthStart, monthEnd, now, thresholds],
  );

  const previous = useMemo(
    () => buildPeriodSummary(events, prevStart, prevEnd, now, thresholds),
    [events, prevStart, prevEnd, now, thresholds],
  );

  const drinkBreakdown = useMemo<DrinkBreakdownItem[]>(() => {
    const effectiveEndMs = Math.min(monthEnd.getTime(), now.getTime());
    const unitsByDrinkKey = aggregate(
      events,
      byDrinkKey,
      sumUnits,
      dateRange(monthStart.getTime(), effectiveEndMs),
    );
    return DRINK_KEY_ORDER.map(drinkKey => ({
      drinkKey,
      units: unitsByDrinkKey.get(drinkKey) ?? 0,
    })).filter(item => item.units > 0);
  }, [events, monthStart, monthEnd, now]);

  return {isLoading, current, previous, drinkBreakdown};
}

export default useHomeStats;
export type {HomeStats};
