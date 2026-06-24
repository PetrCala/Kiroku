import {addDays, format, startOfDay} from 'date-fns';
import type {DrinkEvent} from '@libs/Statistics/types';
import {formatIsoWeek, weekKeysInRange} from './weeks';

type WeeklyAfDaysPoint = {
  isoWeek: string;
  /** Alcohol-free days in this ISO week that fall inside the window. 0–7. */
  afDays: number;
  /** Days of this ISO week that fall inside the window. 1–7. */
  daysInRange: number;
};

type WeeklyAfDaysSummary = {
  /** Alcohol-free days across the whole window. */
  afDays: number;
  /** Total elapsed days across the whole window. */
  totalDays: number;
  /** Alcohol-free share of the window, 0–100, rounded to a whole percent. */
  ratePct: number;
};

/**
 * Alcohol-free days bucketed per ISO week over the inclusive window
 * `[start, end]`. Unlike the cumulative series (which only ever climbs), each
 * week stands on its own: a heavy week is a short bar, an abstinent week is a
 * tall one, so the chart moves in both directions and a relapse is as visible
 * as a streak.
 *
 * Every ISO week the window touches is emitted exactly once (gap-filled and
 * index-aligned with {@link weekKeysInRange}), so the "vs previous period"
 * comparison series lines up row-by-row. Boundary weeks that only partly
 * overlap the window report `daysInRange < 7`; the chart caps the axis at 7 so
 * a full alcohol-free week always reads as a full bar.
 *
 * Reads `localDay` directly to avoid re-deriving the session timezone here.
 */
function buildWeeklyAfDays(
  events: DrinkEvent[],
  start: Date,
  end: Date,
): WeeklyAfDaysPoint[] {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  if (endDay.getTime() < startDay.getTime()) {
    return [];
  }

  const eventDays = new Set<string>();
  for (const event of events) {
    eventDays.add(event.localDay);
  }

  const afByWeek = new Map<string, number>();
  const daysByWeek = new Map<string, number>();
  let cursor = startDay;
  while (cursor.getTime() <= endDay.getTime()) {
    const dayKey = format(cursor, 'yyyy-MM-dd');
    const weekKey = formatIsoWeek(cursor);
    daysByWeek.set(weekKey, (daysByWeek.get(weekKey) ?? 0) + 1);
    if (!eventDays.has(dayKey)) {
      afByWeek.set(weekKey, (afByWeek.get(weekKey) ?? 0) + 1);
    }
    cursor = addDays(cursor, 1);
  }

  return weekKeysInRange(start, end).map(isoWeek => ({
    isoWeek,
    afDays: afByWeek.get(isoWeek) ?? 0,
    daysInRange: daysByWeek.get(isoWeek) ?? 0,
  }));
}

/**
 * Collapse the weekly AF-days series into headline numbers for the chart
 * caption: how many of the window's days were alcohol-free, and what share
 * that is. An empty series reports all zeros.
 */
function summarizeWeeklyAfDays(
  points: WeeklyAfDaysPoint[],
): WeeklyAfDaysSummary {
  let afDays = 0;
  let totalDays = 0;
  for (const point of points) {
    afDays += point.afDays;
    totalDays += point.daysInRange;
  }
  const ratePct = totalDays > 0 ? Math.round((afDays / totalDays) * 100) : 0;
  return {afDays, totalDays, ratePct};
}

export default buildWeeklyAfDays;
export {summarizeWeeklyAfDays};
export type {WeeklyAfDaysPoint, WeeklyAfDaysSummary};
