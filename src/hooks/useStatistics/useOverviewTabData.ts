import {useMemo} from 'react';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useStatsContext from '@hooks/useStatsContext';
import {
  buildPeriodSummary,
  buildSubPeriodSeries,
} from '@libs/Statistics/overview';
import type {
  PeriodSummary,
  SubPeriodPoint,
  Thresholds,
} from '@libs/Statistics/overview';
import {
  selectHasEverLogged,
  selectIsSparse,
} from '@libs/Statistics/overviewSelectors';
import {shiftRange} from '@libs/Statistics/trends';
import useDrinkEvents from './useDrinkEvents';

/** Mirrors the seeded `units_to_colors` default (see User onboarding). */
const DEFAULT_THRESHOLDS: Thresholds = {yellow: 5, orange: 10};

type OverviewTabData = {
  isLoading: boolean;
  hasEverLogged: boolean;
  isSparse: boolean;
  /** True when a comparison window is active (drives delta rendering). */
  comparisonActive: boolean;
  thresholds: Thresholds;
  /** Scorecard metrics for the selected range. */
  current: PeriodSummary;
  /** Same metrics for the comparison window, or null when comparison is off. */
  previous: PeriodSummary | null;
  /**
   * Gap-filled per-sub-period units for the selected range. Feeds both the
   * hero sparkline (trajectory) and the texture bar-list (shape) — one source
   * so the two visuals always agree on granularity.
   */
  subPeriods: SubPeriodPoint[];
};

/**
 * Single composed data hook backing the Overview tab. Reads the event stream
 * once and derives the total-alcohol scorecard for the selected range plus its
 * previous-period twin, all clamped to `now`. Thresholds come from the user's
 * `units_to_colors` preference so "days over X" means the same here as on the
 * home and stats calendars.
 */
function useOverviewTabData(): OverviewTabData {
  const {events, isLoading} = useDrinkEvents();
  const {range, comparison} = useStatsContext();
  const {preferences} = useDatabaseData();
  const thresholds = useMemo(
    () => preferences?.units_to_colors ?? DEFAULT_THRESHOLDS,
    [preferences?.units_to_colors],
  );

  // Snapshot `now` once per mount so current/previous/sub-period clamps agree.
  const now = useMemo(() => new Date(), []);

  const current = useMemo(
    () => buildPeriodSummary(events, range.start, range.end, now, thresholds),
    [events, range.start, range.end, now, thresholds],
  );

  const comparisonRange = useMemo(
    () => shiftRange(range, comparison),
    [range, comparison],
  );

  const previous = useMemo(
    () =>
      comparisonRange
        ? buildPeriodSummary(
            events,
            comparisonRange.start,
            comparisonRange.end,
            now,
            thresholds,
          )
        : null,
    [events, comparisonRange, now, thresholds],
  );

  const subPeriods = useMemo(
    () => buildSubPeriodSeries(events, range, now),
    [events, range, now],
  );

  const hasEverLogged = selectHasEverLogged(events);
  const weeksWithData = useMemo(() => {
    const weeks = new Set<string>();
    for (const e of events) {
      if (e.units > 0) {
        weeks.add(e.localIsoWeek);
      }
    }
    return weeks.size;
  }, [events]);
  const isSparse = selectIsSparse(events, weeksWithData);

  return {
    isLoading,
    hasEverLogged,
    isSparse,
    comparisonActive: comparisonRange !== null,
    thresholds,
    current,
    previous,
    subPeriods,
  };
}

export default useOverviewTabData;
export type {OverviewTabData};
