import type {DrinkEvent} from '@libs/Statistics';

/** One calendar day in the user's timezone, formatted `yyyy-MM-dd`. */
type DayKey = string;

/**
 * Aggregate, all-time badge metrics derived from the drink-event stream.
 *
 * A calendar day is "alcohol-free" when the sum of its logged units is `<= 0`,
 * matching the Statistics overview's dry-day definition (see
 * `libs/Statistics/overview/periodSummary.ts`) so the two screens never
 * disagree on streaks or alcohol-free-day counts.
 */
type BadgesSummary = {
  /** False when the user has never logged a finished session. */
  hasData: boolean;
  /** Consecutive alcohol-free days ending today (0 when today had drinks). */
  currentAfStreak: number;
  /** Longest run of consecutive alcohol-free days ever recorded. */
  longestAfStreak: number;
  /** Total alcohol-free days across the tracked window. */
  totalAfDays: number;
  /** Total days from the first logged day to today, inclusive. */
  totalTrackedDays: number;
  /** Days on which any alcohol was logged. */
  totalDrinkingDays: number;
  /** Distinct finished sessions logged (ongoing sessions are excluded upstream). */
  totalSessions: number;
  /** First tracked calendar day, or `null` when there is no data. */
  firstTrackedDay: DayKey | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a `yyyy-MM-dd` key to a UTC-midnight epoch (DST-safe for date-only math). */
function dayKeyToUtcMs(key: DayKey): number {
  return Date.parse(`${key}T00:00:00Z`);
}

/** Format a UTC-midnight epoch back to a `yyyy-MM-dd` key. */
function utcMsToDayKey(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Derive all-time badge metrics from the (already timezone-bucketed)
 * `DrinkEvent` stream. Pure: `todayKey` is supplied by the caller — computed
 * in the user's timezone — so the streak math is deterministic and testable.
 *
 * Days are enumerated from the first logged day through `todayKey` inclusive;
 * any day without logged units counts as alcohol-free. The window end is
 * extended to the latest event day as a guard against clock skew / future-
 * dated sessions, so trailing data is never under-counted.
 */
function summarizeBadges(
  events: readonly DrinkEvent[],
  todayKey: DayKey,
): BadgesSummary {
  if (events.length === 0) {
    return {
      hasData: false,
      currentAfStreak: 0,
      longestAfStreak: 0,
      totalAfDays: 0,
      totalTrackedDays: 0,
      totalDrinkingDays: 0,
      totalSessions: 0,
      firstTrackedDay: null,
    };
  }

  const unitsByDay = new Map<DayKey, number>();
  const sessionIds = new Set<string>();
  let firstTrackedDay: DayKey = todayKey;
  let lastEventDay: DayKey = todayKey;
  for (const event of events) {
    unitsByDay.set(
      event.localDay,
      (unitsByDay.get(event.localDay) ?? 0) + event.units,
    );
    sessionIds.add(event.sessionId);
    if (event.localDay < firstTrackedDay) {
      firstTrackedDay = event.localDay;
    }
    if (event.localDay > lastEventDay) {
      lastEventDay = event.localDay;
    }
  }

  const startMs = dayKeyToUtcMs(firstTrackedDay);
  // Never end before the last event day (guards clock skew / future sessions).
  const endMs = Math.max(dayKeyToUtcMs(todayKey), dayKeyToUtcMs(lastEventDay));

  let totalAfDays = 0;
  let totalDrinkingDays = 0;
  let totalTrackedDays = 0;
  let longestAfStreak = 0;
  // Tracks the run ending on the day currently being visited; because the loop
  // ends on the final day, its terminal value is the current streak.
  let runEndingHere = 0;
  for (let dayMs = startMs; dayMs <= endMs; dayMs += MS_PER_DAY) {
    const units = unitsByDay.get(utcMsToDayKey(dayMs)) ?? 0;
    totalTrackedDays += 1;
    if (units <= 0) {
      totalAfDays += 1;
      runEndingHere += 1;
      if (runEndingHere > longestAfStreak) {
        longestAfStreak = runEndingHere;
      }
    } else {
      totalDrinkingDays += 1;
      runEndingHere = 0;
    }
  }

  return {
    hasData: true,
    currentAfStreak: runEndingHere,
    longestAfStreak,
    totalAfDays,
    totalTrackedDays,
    totalDrinkingDays,
    totalSessions: sessionIds.size,
    firstTrackedDay,
  };
}

/** Per-badge target thresholds. The key set is the canonical badge id union. */
const BADGE_TARGETS = {
  /** Logged a first finished session. */
  firstSession: 1,
  /** Recorded a first alcohol-free day. */
  dryDay: 1,
  /** Reached a 7-day alcohol-free streak. */
  dryWeek: 7,
  /** Reached a 14-day alcohol-free streak. */
  dryFortnight: 14,
  /** Reached a 30-day alcohol-free streak. */
  dryMonth: 30,
  /** Accumulated 10 alcohol-free days. */
  afDays10: 10,
  /** Accumulated 50 alcohol-free days. */
  afDays50: 50,
  /** Logged 25 sessions. */
  sessions25: 25,
} as const;

/** Canonical badge identifier. Mirrors the `badgesScreen.badges.*` keys. */
type BadgeId = keyof typeof BADGE_TARGETS;

/** Render order for the badges grid. */
const BADGE_ORDER: readonly BadgeId[] = [
  'firstSession',
  'dryDay',
  'dryWeek',
  'dryFortnight',
  'dryMonth',
  'afDays10',
  'afDays50',
  'sessions25',
];

/** A single badge's earned/locked status plus clamped progress for display. */
type BadgeStatus = {
  id: BadgeId;
  earned: boolean;
  /** Progress toward `target`, clamped to `[0, target]`. */
  current: number;
  target: number;
};

/** The raw (unclamped) metric backing each badge. */
function metricFor(id: BadgeId, summary: BadgesSummary): number {
  switch (id) {
    case 'firstSession':
    case 'sessions25':
      return summary.totalSessions;
    case 'dryDay':
    case 'afDays10':
    case 'afDays50':
      return summary.totalAfDays;
    case 'dryWeek':
    case 'dryFortnight':
    case 'dryMonth':
      return summary.longestAfStreak;
    default:
      return 0;
  }
}

/**
 * Resolve every badge's status from a summary, in display order. Progress is
 * clamped to the target so a locked badge reads e.g. `5 / 7` and an earned one
 * reads `7 / 7`.
 */
function computeBadges(summary: BadgesSummary): BadgeStatus[] {
  return BADGE_ORDER.map(id => {
    const target = BADGE_TARGETS[id];
    const current = Math.min(metricFor(id, summary), target);
    return {id, target, current, earned: current >= target};
  });
}

export {summarizeBadges, computeBadges, BADGE_TARGETS, BADGE_ORDER};
export type {BadgesSummary, BadgeId, BadgeStatus};
