import {addDays, format, startOfDay} from 'date-fns';
import type {DrinkEvent} from '@libs/Statistics/types';

type AfCumulativePoint = {
  date: string;
  count: number;
};

type AfCumulativeSummary = {
  /** Alcohol-free days in the window (the final cumulative count). */
  afDays: number;
  /** Total elapsed days in the window. */
  totalDays: number;
  /** Alcohol-free share of the window, 0–100, rounded to a whole percent. */
  ratePct: number;
};

/**
 * Cumulative alcohol-free-days series over the inclusive window
 * `[start, end]`. The counter accumulates across the entire window and never
 * resets, including at year boundaries, so the line only ever climbs from the
 * bottom-left to the top-right. One point per day:
 *
 *   - if a day has no drink events in `events`, the counter increments and
 *     the new value is emitted.
 *   - if a day has any drink events, the counter is unchanged.
 *
 * Both branches emit a point so the resulting series is dense and
 * monotonically non-decreasing across the whole window, the chart's
 * "only-up line" visual. Reads `localDay` directly to avoid re-deriving the
 * session timezone here.
 */
function buildAfCumulativeSeries(
  events: DrinkEvent[],
  start: Date,
  end: Date,
): AfCumulativePoint[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  if (endDay.getTime() < startDay.getTime()) {
    return [];
  }

  const eventDays = new Set<string>();
  for (const event of events) {
    eventDays.add(event.localDay);
  }

  const out: AfCumulativePoint[] = [];
  let counter = 0;
  let cursor = startDay;
  while (cursor.getTime() <= endDay.getTime()) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (!eventDays.has(key)) {
      counter += 1;
    }
    out.push({date: key, count: counter});
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Collapse a cumulative AF-days series into headline numbers for the chart
 * caption: how many of the window's days were alcohol-free, and what share
 * that is. The final point already holds the running total, so this is an O(1)
 * read of the tail rather than a re-scan. An empty series reports all zeros.
 */
function summarizeAfCumulative(
  points: AfCumulativePoint[],
): AfCumulativeSummary {
  const totalDays = points.length;
  const afDays = totalDays > 0 ? points[totalDays - 1].count : 0;
  const ratePct = totalDays > 0 ? Math.round((afDays / totalDays) * 100) : 0;
  return {afDays, totalDays, ratePct};
}

export default buildAfCumulativeSeries;
export {summarizeAfCumulative};
export type {AfCumulativePoint, AfCumulativeSummary};
