import {useMemo} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {useOnyx} from 'react-native-onyx';
import type {DateData} from 'react-native-calendars';
import type {Range} from '@components/StatsContextProvider/types';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useDrinkEvents from '@hooks/useStatistics/useDrinkEvents';
import {calculateThisMonthUnits} from '@libs/DataHandling';
import {
  buildPeriodSummary,
  buildSubPeriodSeries,
} from '@libs/Statistics/overview';
import type {
  PeriodSummary,
  SubPeriodPoint,
  Thresholds,
} from '@libs/Statistics/overview';
import ONYXKEYS from '@src/ONYXKEYS';

/** Mirrors the seeded `units_to_colors` default (see User onboarding). */
const DEFAULT_THRESHOLDS: Thresholds = {yellow: 5, orange: 10};

type HomeStats = {
  /** True while the underlying event stream is still compiling. */
  isLoading: boolean;
  /** Scorecard metrics for the visible calendar month. */
  current: PeriodSummary;
  /** Same metrics for the month before, for "vs last month" deltas. */
  previous: PeriodSummary;
  /** Gap-filled per-week units for the visible month (drives the bar chart). */
  subPeriods: SubPeriodPoint[];
  /**
   * Units from the in-progress live session that fall in the visible month.
   * The live buffer lives only in `ONGOING_SESSION_DATA`, not the cached
   * snapshot the event stream reads from, so the caller overlays this on the
   * cached totals. 0 for past months or when no session is ongoing.
   */
  liveExtraUnits: number;
};

/**
 * Home-screen stats derived from the Statistics v2 event stream for the
 * calendar month the user is currently viewing (`visibleDate`), plus its
 * previous-month twin for deltas. Thresholds come from the user's
 * `units_to_colors` preference so "alcohol-free" means the same here as on
 * the calendars and the Statistics screen.
 */
function useHomeStats(visibleDate: DateData): HomeStats {
  const {events, isLoading} = useDrinkEvents();
  const preferences = useCurrentUserPreferences();
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const isFocused = useIsFocused();

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

  // A month preset buckets the series by ISO week — one bar per week.
  const monthRange = useMemo<Range>(
    () => ({
      start: monthStart,
      end: monthEnd,
      preset: 'M',
      offset: 0,
      isPageable: true,
      canGoPrev: false,
      canGoNext: false,
      isLatest: false,
    }),
    [monthStart, monthEnd],
  );

  const subPeriods = useMemo(
    () => buildSubPeriodSeries(events, monthRange, now),
    [events, monthRange, now],
  );

  // Overlay the live session's units (visible month only). Gated on focus
  // because the buffer mutates on every drink tap while Home stays mounted
  // behind the live-session screen.
  const drinksToUnits = preferences?.drinks_to_units;
  const liveExtraUnits = useMemo(() => {
    if (!isFocused || !drinksToUnits || !ongoingSessionData?.ongoing) {
      return 0;
    }
    return calculateThisMonthUnits(
      visibleDate,
      [ongoingSessionData],
      drinksToUnits,
    );
  }, [isFocused, ongoingSessionData, visibleDate, drinksToUnits]);

  return {isLoading, current, previous, subPeriods, liveExtraUnits};
}

export default useHomeStats;
export type {HomeStats};
