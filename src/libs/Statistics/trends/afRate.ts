import {addDays, format, startOfDay} from 'date-fns';
import type {DrinkEvent} from '@libs/Statistics/types';

type AfRatePoint = {
  date: string;
  /** Alcohol-free share of the trailing window ending on `date`, 0–100. */
  rate: number;
};

type AfRateSummary = {
  /** Most recent rolling rate (the last point), 0–100. */
  currentRate: number;
};

/** Trailing-window length, in days, for the rolling alcohol-free rate. */
const AF_RATE_WINDOW_DAYS = 30;

/**
 * Rolling alcohol-free rate over the inclusive window `[start, end]`. For each
 * day it reports the share of the trailing {@link AF_RATE_WINDOW_DAYS} days that
 * were alcohol-free, as a 0–100 percentage. One point per day.
 *
 * Where the cumulative line only ever climbs, this rate *falls* during a
 * drinking stretch and *rises* during abstinence, so the curve carries the
 * user's current momentum: a relapse pulls it down within days, a clean streak
 * lifts it back toward 100. The window is clamped to the range start (it never
 * looks at days before `start`), so early points use a shorter, expanding
 * window rather than inventing pre-history — the denominator is
 * `min(elapsedDays, window)`.
 *
 * Computed with a single sliding-window pass (O(days)). Reads `localDay`
 * directly to avoid re-deriving the session timezone here.
 */
function buildAfRateSeries(
  events: DrinkEvent[],
  start: Date,
  end: Date,
  windowDays: number = AF_RATE_WINDOW_DAYS,
): AfRatePoint[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  if (endDay.getTime() < startDay.getTime()) {
    return [];
  }

  const eventDays = new Set<string>();
  for (const event of events) {
    eventDays.add(event.localDay);
  }

  // Alcohol-free flag (1/0) per day across the range, in order.
  const afFlags: number[] = [];
  const dates: string[] = [];
  let cursor = startDay;
  while (cursor.getTime() <= endDay.getTime()) {
    const key = format(cursor, 'yyyy-MM-dd');
    dates.push(key);
    afFlags.push(eventDays.has(key) ? 0 : 1);
    cursor = addDays(cursor, 1);
  }

  const out: AfRatePoint[] = [];
  let windowSum = 0;
  for (let i = 0; i < afFlags.length; i += 1) {
    windowSum += afFlags[i];
    if (i >= windowDays) {
      windowSum -= afFlags[i - windowDays];
    }
    const windowCount = Math.min(i + 1, windowDays);
    out.push({
      date: dates[i],
      rate: Math.round((windowSum / windowCount) * 100),
    });
  }
  return out;
}

/**
 * Headline number for the chart caption: the most recent rolling rate. An empty
 * series reports zero.
 */
function summarizeAfRate(points: AfRatePoint[]): AfRateSummary {
  const currentRate = points.length > 0 ? points[points.length - 1].rate : 0;
  return {currentRate};
}

export default buildAfRateSeries;
export {summarizeAfRate, AF_RATE_WINDOW_DAYS};
export type {AfRatePoint, AfRateSummary};
