import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfISOWeek,
  endOfMonth,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
  subWeeks,
} from 'date-fns';
import aggregate from './aggregate';
import {byDay, byIsoWeek} from './bucketers';
import {countSessions, sumSdu, sumUnits} from './reducers';
import {ewma, mannKendall, percentile} from './stats';
import type {MannKendallResult} from './stats/mannKendall';
import type {ChartDatum, DrinkEvent, HeatmapCell} from './types';

const TREND_WINDOW_WEEKS = 8;
const SPARSE_WEEK_THRESHOLD = 4;

type AfDaysResult = {
  /** Elapsed days alcohol-free in the current calendar month. */
  value: number;
  /** Denominator: days elapsed in the month, inclusive of today. */
  total: number;
};

type WeeklyKpis = {
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  quietDaysThisWeek: number;
  quietDaysLastWeek: number;
  unitsThisWeek: number;
  unitsLastWeek: number;
};

type TrendSeries = {
  /** 8 weekly points, oldest → newest, units summed per ISO week. */
  points: ChartDatum[];
  band: {p25: number; p75: number};
  ewma: number[];
  mannKendall: MannKendallResult;
  /** Weeks in the window with at least one event. */
  weeksWithData: number;
};

function isoWeekLabel(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Pick a 1..4 intensity for a day's SDU value. Uses quartiles of the
 * non-zero days when there's enough samples (≥4); otherwise falls back to
 * fixed SDU thresholds so a 1-day-into-the-month user still sees variation.
 * Days with zero SDU map to 0 unconditionally.
 */
function computeIntensity(
  sdu: number,
  sortedNonZero: readonly number[],
): 0 | 1 | 2 | 3 | 4 {
  if (sdu <= 0) {
    return 0;
  }
  if (sortedNonZero.length < 4) {
    if (sdu <= 1) {
      return 1;
    }
    if (sdu <= 3) {
      return 2;
    }
    if (sdu <= 6) {
      return 3;
    }
    return 4;
  }
  const sorted = [...sortedNonZero];
  const q1 = percentile(sorted, 0.25);
  const q2 = percentile(sorted, 0.5);
  const q3 = percentile(sorted, 0.75);
  if (sdu <= q1) {
    return 1;
  }
  if (sdu <= q2) {
    return 2;
  }
  if (sdu <= q3) {
    return 3;
  }
  return 4;
}

/**
 * One `HeatmapCell` per calendar day of `now`'s month. Days beyond today
 * carry `isFuture: true` so the renderer can skip drawing per
 * DIRECTION_REVIEW.md §6.2. SDU per day comes from `aggregate(events,
 * byDay, sumSdu)`.
 */
function selectThisMonthHeatmapCells(
  events: readonly DrinkEvent[],
  now: Date,
): HeatmapCell[] {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const today = startOfDay(now);

  // Bucket every event by its `localDay`; out-of-month events simply never
  // match the `dateKey` lookup below, so filtering by ts is unnecessary and
  // would re-introduce the device-vs-user timezone seam.
  const sduByDay = aggregate(events, byDay, sumSdu);

  const days = eachDayOfInterval({start: monthStart, end: monthEnd});
  const monthPrefix = format(monthStart, 'yyyy-MM');

  // Intensity ramp is relative to this month's own non-zero days so a fresh
  // month never inherits last month's scale.
  const nonZeroSdu: number[] = [];
  for (const [key, value] of sduByDay) {
    if (value > 0 && key.startsWith(monthPrefix)) {
      nonZeroSdu.push(value);
    }
  }
  nonZeroSdu.sort((a, b) => a - b);

  return days.map(day => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const isFuture = day.getTime() > today.getTime();
    const totalSdu = sduByDay.get(dateKey) ?? 0;
    const intensity = isFuture ? 0 : computeIntensity(totalSdu, nonZeroSdu);
    return {dateKey, totalSdu, intensity, isFuture};
  });
}

/**
 * Alcohol-free days in the current month, clamped to elapsed days per
 * DIRECTION_REVIEW.md §3 (so a fresh month on day 1 reads 1/1, not 1/31).
 */
function drinkDayKeysInRange(
  events: readonly DrinkEvent[],
  startKey: string,
  endKey: string,
): Set<string> {
  const set = new Set<string>();
  for (const event of events) {
    if (event.localDay >= startKey && event.localDay <= endKey) {
      set.add(event.localDay);
    }
  }
  return set;
}

function selectAfDaysThisMonth(
  events: readonly DrinkEvent[],
  now: Date,
): AfDaysResult {
  const monthStart = startOfMonth(now);
  const today = startOfDay(now);
  const total = differenceInCalendarDays(today, monthStart) + 1;
  const drinkDays = drinkDayKeysInRange(
    events,
    format(monthStart, 'yyyy-MM-dd'),
    format(today, 'yyyy-MM-dd'),
  ).size;
  const value = Math.max(0, total - drinkDays);
  return {value, total};
}

function quietDaysInRange(
  events: readonly DrinkEvent[],
  start: Date,
  end: Date,
): number {
  const elapsed = differenceInCalendarDays(end, start) + 1;
  if (elapsed <= 0) {
    return 0;
  }
  const drinkDays = drinkDayKeysInRange(
    events,
    format(start, 'yyyy-MM-dd'),
    format(end, 'yyyy-MM-dd'),
  ).size;
  return Math.max(0, elapsed - drinkDays);
}

function selectWeeklyKpis(
  events: readonly DrinkEvent[],
  now: Date,
): WeeklyKpis {
  const today = startOfDay(now);
  const thisWeekStart = startOfISOWeek(now);
  const thisWeekEnd = endOfISOWeek(now);
  const lastWeekStart = subWeeks(thisWeekStart, 1);
  const lastWeekEnd = subWeeks(thisWeekEnd, 1);

  const sessionsBy = aggregate(events, byIsoWeek, countSessions);
  const unitsBy = aggregate(events, byIsoWeek, sumUnits);

  const thisLabel = isoWeekLabel(now);
  const lastLabel = isoWeekLabel(lastWeekStart);

  // For "this week" quiet days, clamp the upper bound to today so days that
  // haven't elapsed yet don't auto-count as quiet (mirrors the AF-days fix).
  const thisWeekClampedEnd = today < thisWeekEnd ? today : thisWeekEnd;

  return {
    sessionsThisWeek: sessionsBy.get(thisLabel) ?? 0,
    sessionsLastWeek: sessionsBy.get(lastLabel) ?? 0,
    quietDaysThisWeek: quietDaysInRange(
      events,
      thisWeekStart,
      thisWeekClampedEnd,
    ),
    quietDaysLastWeek: quietDaysInRange(events, lastWeekStart, lastWeekEnd),
    unitsThisWeek: unitsBy.get(thisLabel) ?? 0,
    unitsLastWeek: unitsBy.get(lastLabel) ?? 0,
  };
}

/**
 * Last 8 ISO weeks ending with the current week, oldest → newest. Missing
 * weeks fill in as 0 so EWMA and Mann–Kendall see a contiguous series.
 */
function selectTrendSeries(
  events: readonly DrinkEvent[],
  now: Date,
): TrendSeries {
  const unitsBy = aggregate(events, byIsoWeek, sumUnits);
  const currentWeekStart = startOfISOWeek(now);

  const points: ChartDatum[] = [];
  const values: number[] = [];
  let weeksWithData = 0;

  for (let i = TREND_WINDOW_WEEKS - 1; i >= 0; i -= 1) {
    const weekDate = subWeeks(currentWeekStart, i);
    const label = isoWeekLabel(weekDate);
    const value = unitsBy.get(label) ?? 0;
    if (value > 0) {
      weeksWithData += 1;
    }
    points.push({x: label, y: value});
    values.push(value);
  }

  const band = {
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
  };
  const smoothed = ewma(values);
  const trend = mannKendall(values);

  return {points, band, ewma: smoothed, mannKendall: trend, weeksWithData};
}

function selectIsSparse(
  events: readonly DrinkEvent[],
  weeksWithData: number,
): boolean {
  return events.length === 0 || weeksWithData < SPARSE_WEEK_THRESHOLD;
}

function selectHasEverLogged(events: readonly DrinkEvent[]): boolean {
  return events.length > 0;
}

export {
  isoWeekLabel,
  SPARSE_WEEK_THRESHOLD,
  selectAfDaysThisMonth,
  selectHasEverLogged,
  selectIsSparse,
  selectThisMonthHeatmapCells,
  selectTrendSeries,
  selectWeeklyKpis,
  TREND_WINDOW_WEEKS,
};
export type {AfDaysResult, TrendSeries, WeeklyKpis};
