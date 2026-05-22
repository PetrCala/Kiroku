import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {DayRollup, KpiDelta, KpiValue} from '@libs/Statistics/types';

type SelectKpisOptions = {
  /** Anchor for "this week" / "this month" — typically `new Date()`. */
  asOfDate: Date;
  /** Timezone the rollups were built with. */
  timezone: SelectedTimezone;
  /** 0 = Sunday, 1 = Monday. Default: 1. */
  weekStartsOn?: 0 | 1;
};

/**
 * Compute the v1 summary-card KPIs:
 *   - alcoholFreeDays — count of days this month with no rollup
 *   - sessionsThisWeek — count of session start_times this week, + delta
 *   - avgUnitsPerSession — rolling 30d total SDU / session count
 *   - totalUnitsThisWeek — sum of totalSdu this week, + delta
 *
 * Delta direction is `'flat'` within ±0.005 to avoid noisy chevrons.
 */
function selectKpis(
  rollups: DayRollup[],
  sessionCountsByDay: Record<string, number>,
  options: SelectKpisOptions,
): KpiValue[] {
  const {asOfDate, timezone, weekStartsOn = 1} = options;
  const localAnchor = toZonedTime(asOfDate, timezone);

  const rollupByDay = new Map<string, DayRollup>();
  for (const r of rollups) {
    rollupByDay.set(r.dateKey, r);
  }

  const thisWeekStart = startOfWeek(localAnchor, {weekStartsOn});
  const thisWeekEnd = endOfWeek(localAnchor, {weekStartsOn});
  const lastWeekAnchor = subWeeks(localAnchor, 1);
  const lastWeekStart = startOfWeek(lastWeekAnchor, {weekStartsOn});
  const lastWeekEnd = endOfWeek(lastWeekAnchor, {weekStartsOn});

  const thisMonthStart = startOfMonth(localAnchor);
  const thisMonthEnd = endOfMonth(localAnchor);

  const rolling30End = localAnchor;
  const rolling30Start = subDays(localAnchor, 29);

  const totalUnitsThisWeek = sumSduInRange(
    rollupByDay,
    thisWeekStart,
    thisWeekEnd,
  );
  const totalUnitsLastWeek = sumSduInRange(
    rollupByDay,
    lastWeekStart,
    lastWeekEnd,
  );

  const sessionsThisWeek = sumSessionsInRange(
    sessionCountsByDay,
    thisWeekStart,
    thisWeekEnd,
  );
  const sessionsLastWeek = sumSessionsInRange(
    sessionCountsByDay,
    lastWeekStart,
    lastWeekEnd,
  );

  const daysInMonth = eachDayOfInterval({
    start: thisMonthStart,
    end: thisMonthEnd,
  });
  let drinkDaysThisMonth = 0;
  for (const day of daysInMonth) {
    if (rollupByDay.has(format(day, 'yyyy-MM-dd'))) {
      drinkDaysThisMonth += 1;
    }
  }
  const alcoholFreeDaysThisMonth = daysInMonth.length - drinkDaysThisMonth;

  const rolling30Sdu = sumSduInRange(rollupByDay, rolling30Start, rolling30End);
  const rolling30Sessions = sumSessionsInRange(
    sessionCountsByDay,
    rolling30Start,
    rolling30End,
  );
  const avgUnitsPerSession =
    rolling30Sessions > 0
      ? Number((rolling30Sdu / rolling30Sessions).toFixed(2))
      : 0;

  return [
    {
      key: 'alcoholFreeDays',
      value: alcoholFreeDaysThisMonth,
    },
    {
      key: 'sessionsThisWeek',
      value: sessionsThisWeek,
      delta: makeDelta(sessionsThisWeek, sessionsLastWeek, 'vsLastWeek'),
    },
    {
      key: 'avgUnitsPerSession',
      value: avgUnitsPerSession,
    },
    {
      key: 'totalUnitsThisWeek',
      value: Number(totalUnitsThisWeek.toFixed(2)),
      delta: makeDelta(totalUnitsThisWeek, totalUnitsLastWeek, 'vsLastWeek'),
    },
  ];
}

function sumSduInRange(
  rollupByDay: Map<string, DayRollup>,
  start: Date,
  end: Date,
): number {
  let total = 0;
  for (const day of eachDayOfInterval({start, end})) {
    const r = rollupByDay.get(format(day, 'yyyy-MM-dd'));
    if (r) {
      total += r.totalSdu;
    }
  }
  return total;
}

function sumSessionsInRange(
  sessionCountsByDay: Record<string, number>,
  start: Date,
  end: Date,
): number {
  let total = 0;
  for (const day of eachDayOfInterval({start, end})) {
    total += sessionCountsByDay[format(day, 'yyyy-MM-dd')] ?? 0;
  }
  return total;
}

function makeDelta(
  current: number,
  prior: number,
  comparisonKey: 'vsLastWeek' | 'vsLastMonth',
): KpiDelta {
  const diff = current - prior;
  let direction: 'up' | 'down' | 'flat';
  if (Math.abs(diff) < 0.005) {
    direction = 'flat';
  } else if (diff > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }
  return {value: Number(diff.toFixed(2)), direction, comparisonKey};
}

export default selectKpis;
export type {SelectKpisOptions};
