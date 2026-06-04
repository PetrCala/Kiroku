import type {DrinkEvent} from '@libs/Statistics/types';
import type {Range} from '@components/StatsContextProvider/types';
import {dayKeysInRange} from './keys';
import buildPeriodSummary, {
  EMPTY_SUMMARY,
  summarizePeriod,
} from './periodSummary';
import type {PeriodSummary, Thresholds} from './periodSummary';
import {bucketerFor, pickGranularity, seriesFromUnits} from './subPeriod';
import type {SubPeriodPoint} from './subPeriod';
import collectWindowAggregates from './windowAggregates';

type OverviewModel = {
  current: PeriodSummary;
  previous: PeriodSummary | null;
  subPeriods: SubPeriodPoint[];
};

/**
 * Everything the Overview scorecard needs, in the fewest passes over `events`:
 *
 * - The current window is walked ONCE — {@link collectWindowAggregates} yields
 *   the per-day unit sums, the sub-period series sums, and the session count
 *   together. (Previously the same window was walked three times: a per-day
 *   aggregate, an in-window session loop, and a sub-period aggregate, each
 *   allocating per-bucket arrays.)
 * - The comparison window is a separate single pass, and only when active.
 */
function buildOverviewModel(
  events: readonly DrinkEvent[],
  range: Range,
  comparisonRange: {start: Date; end: Date} | null,
  now: Date,
  thresholds: Thresholds,
): OverviewModel {
  const startMs = range.start.getTime();
  const effectiveEndMs = Math.min(range.end.getTime(), now.getTime());
  const granularity = pickGranularity(range);

  let current: PeriodSummary = EMPTY_SUMMARY;
  let subPeriods: SubPeriodPoint[] = [];
  if (effectiveEndMs >= startMs) {
    const effectiveEnd = new Date(effectiveEndMs);
    const {unitsByDay, unitsBySubPeriod, sessionCount} =
      collectWindowAggregates(
        events,
        startMs,
        effectiveEndMs,
        bucketerFor(granularity),
      );
    current = summarizePeriod(
      unitsByDay,
      sessionCount,
      dayKeysInRange(range.start, effectiveEnd),
      thresholds,
    );
    subPeriods = seriesFromUnits(
      unitsBySubPeriod,
      granularity,
      range.start,
      effectiveEnd,
    );
  }

  const previous = comparisonRange
    ? buildPeriodSummary(
        events,
        comparisonRange.start,
        comparisonRange.end,
        now,
        thresholds,
      )
    : null;

  return {current, previous, subPeriods};
}

export default buildOverviewModel;
export type {OverviewModel};
