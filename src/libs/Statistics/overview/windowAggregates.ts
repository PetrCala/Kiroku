import type {Bucketer} from '@libs/Statistics/aggregate';
import type {DrinkEvent} from '@libs/Statistics/types';

/**
 * Running-sum aggregates for one inclusive `[startMs, endMs]` window, collected
 * in a single pass over `events`. Replaces the separate
 * `aggregate(events, bucketer, sumUnits, dateRange(...))` calls the Overview tab
 * used to make per metric: those each re-walked the events AND allocated a
 * `DrinkEvent[]` per bucket only to fold it to a scalar. Here the sums are
 * accumulated directly, so no per-bucket arrays are created.
 */
type WindowAggregates = {
  /** Units summed per `localDay` key (matches the `byDay` bucketer). */
  unitsByDay: Map<string, number>;
  /** Units summed per sub-period key; empty when no `subPeriodBucketer`. */
  unitsBySubPeriod: Map<string, number>;
  /** Distinct sessions with at least one event inside the window. */
  sessionCount: number;
};

function collectWindowAggregates(
  events: readonly DrinkEvent[],
  startMs: number,
  endMs: number,
  subPeriodBucketer?: Bucketer<string>,
): WindowAggregates {
  const unitsByDay = new Map<string, number>();
  const unitsBySubPeriod = new Map<string, number>();
  const sessionIds = new Set<string>();
  for (const event of events) {
    // Window by the session's anchor (start_time), not the per-drink `ts`, so a
    // session that crosses midnight/month-end is counted whole on the day it
    // started — never split across, nor double-counted into, two windows.
    if (event.anchorTs < startMs || event.anchorTs > endMs) {
      continue;
    }
    sessionIds.add(event.sessionId);
    const dayKey = event.localDay;
    unitsByDay.set(dayKey, (unitsByDay.get(dayKey) ?? 0) + event.units);
    if (subPeriodBucketer) {
      const subKey = subPeriodBucketer(event);
      unitsBySubPeriod.set(
        subKey,
        (unitsBySubPeriod.get(subKey) ?? 0) + event.units,
      );
    }
  }
  return {unitsByDay, unitsBySubPeriod, sessionCount: sessionIds.size};
}

export default collectWindowAggregates;
export type {WindowAggregates};
