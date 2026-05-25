import {addDays, format, startOfDay} from 'date-fns';
import type {DrinkEvent} from '@libs/Statistics/types';

type AfYtdPoint = {
  date: string;
  count: number;
};

/**
 * Cumulative alcohol-free-days series over the inclusive window
 * `[start, end]`, resetting to 0 at each Jan 1. One point per day:
 *
 *   - on Jan 1 the counter resets to 0 before evaluating that day.
 *   - if a day has no drink events in `events`, the counter increments and
 *     the new value is emitted.
 *   - if a day has any drink events, the counter is unchanged.
 *
 * Both branches emit a point so the resulting series is dense and
 * monotonically non-decreasing within each calendar year — the chart's
 * "only-up line" visual. Reads `localDay` directly to avoid re-deriving the
 * session timezone here.
 */
function buildAfYtdSeries(
  events: DrinkEvent[],
  start: Date,
  end: Date,
): AfYtdPoint[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  if (endDay.getTime() < startDay.getTime()) {
    return [];
  }

  const eventDays = new Set<string>();
  for (const event of events) {
    eventDays.add(event.localDay);
  }

  const out: AfYtdPoint[] = [];
  let counter = 0;
  let cursor = startDay;
  while (cursor.getTime() <= endDay.getTime()) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (key.endsWith('-01-01')) {
      counter = 0;
    }
    if (!eventDays.has(key)) {
      counter += 1;
    }
    out.push({date: key, count: counter});
    cursor = addDays(cursor, 1);
  }
  return out;
}

export default buildAfYtdSeries;
export type {AfYtdPoint};
