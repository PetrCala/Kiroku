import {addDays, format, startOfDay, subDays} from 'date-fns';
import type {DrinkEvent} from '@libs/Statistics/types';

type AfRatePoint = {
  date: string;
  /** Alcohol-free share of the trailing window ending on `date`, 0–100. */
  rate: number;
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
 * lifts it back toward 100.
 *
 * The trailing window is *pre-rolled* `windowDays - 1` days before `start`
 * using the full event history, so the very first emitted point already sits on
 * a full window — it reads as the rate the user was *carrying into* the period
 * (continuous with what came before) rather than a stiff 0%/100% from a
 * one-day window. Days with no logged drink count as alcohol-free here, exactly
 * as the cumulative and weekly builders treat them.
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

  // Begin the scan before the visible range so the first emitted point already
  // has a full trailing window (the rate carried into the period).
  const scanStart = subDays(startDay, windowDays - 1);

  const out: AfRatePoint[] = [];
  const flags: number[] = [];
  let windowSum = 0;
  let cursor = scanStart;
  let i = 0;
  while (cursor.getTime() <= endDay.getTime()) {
    const key = format(cursor, 'yyyy-MM-dd');
    const af = eventDays.has(key) ? 0 : 1;
    flags.push(af);
    windowSum += af;
    if (i >= windowDays) {
      windowSum -= flags[i - windowDays];
    }
    const windowCount = Math.min(i + 1, windowDays);
    // Only emit once inside the visible range; earlier days are pre-roll.
    if (cursor.getTime() >= startDay.getTime()) {
      out.push({
        date: key,
        rate: Math.round((windowSum / windowCount) * 100),
      });
    }
    cursor = addDays(cursor, 1);
    i += 1;
  }
  return out;
}

export default buildAfRateSeries;
export {AF_RATE_WINDOW_DAYS};
export type {AfRatePoint};
