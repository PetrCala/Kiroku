import {addWeeks, format, startOfISOWeek} from 'date-fns';

/**
 * Canonical ISO-8601 week label, matching the `localIsoWeek` field on
 * `DrinkEvent` (`RRRR-'W'II`). Use this when keying chart data by week so
 * `aggregate(events, byIsoWeek, …)` and the chart's x-axis labels line up.
 */
function formatIsoWeek(date: Date): string {
  return format(date, "RRRR-'W'II");
}

/**
 * Ordered ISO-week labels covering the inclusive `[start, end]` window. The
 * cursor always lives on `startOfISOWeek(start)` so a range that straddles a
 * week boundary still emits both weeks.
 */
function weekKeysInRange(start: Date, end: Date): string[] {
  const cursor = startOfISOWeek(start);
  const last = startOfISOWeek(end);
  const labels: string[] = [];
  let current = cursor;
  while (current.getTime() <= last.getTime()) {
    labels.push(formatIsoWeek(current));
    current = addWeeks(current, 1);
  }
  return labels;
}

export {formatIsoWeek, weekKeysInRange};
