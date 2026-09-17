import {getSessionEntries} from '@libs/SessionEntries';
import {resolveLocalParts} from '@libs/Statistics/localParts';
import {isStoredLocalParts} from '@libs/Statistics/sessionTimeParts';
import CONST from '@src/CONST';
import type {
  DrinkingSession,
  DrinkingSessionList,
  DrinkKey,
} from '@src/types/onyx';
import type {
  DrinkDistribution,
  DrinkProfile,
  RankEntry,
  TimeBucket,
} from './types';

/** How many of the user's most recent sessions feed the profile. */
const SESSION_WINDOW = 30;

/**
 * Each session back in time weighs this much less than the one after it, so
 * the last ten sessions carry about 80% of the weight and a change of taste
 * shows within a handful of sessions.
 */
const SESSION_DECAY = 0.85;

/**
 * How many sessions' worth of the population prior sit behind the overall
 * distribution: one real session already outweighs it, ten make it negligible.
 */
const PRIOR_WEIGHT = 1;

/**
 * How many sessions' worth of the user's overall distribution sit behind each
 * part of the day, so a part with little data follows the user's habits rather
 * than its few samples.
 */
const BUCKET_PRIOR_WEIGHT = 2;

/**
 * What people drink in general, for a user with no history. The order extends
 * the fixed quick-add fallback the live card started with (beer, wine, strong
 * shot) to every drink type.
 */
const POPULATION_PRIOR: DrinkDistribution = {
  beer: 0.3,
  wine: 0.22,
  small_beer: 0.14,
  strong_shot: 0.12,
  cocktail: 0.1,
  weak_shot: 0.07,
  other: 0.05,
};

const TIME_BUCKETS: readonly TimeBucket[] = ['day', 'evening', 'night', 'late'];

/** Ties keep the app's drink order, so the row looks the same across launches. */
const DRINK_KEY_ORDER: readonly DrinkKey[] = Object.values(CONST.DRINKS.KEYS);

/** Probabilities are rounded to this many decimals: enough to rank, small on the wire. */
const PROBABILITY_DECIMALS = 4;

/**
 * The part of the day an hour falls in: day (5 to 16), evening (17 to 20),
 * night (21 to 0) and late (1 to 4). The boundaries only need to tell a dinner
 * from a late night.
 */
function getTimeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 17) {
    return 'day';
  }
  if (hour >= 17 && hour < 21) {
    return 'evening';
  }
  if (hour >= 21 || hour === 0) {
    return 'night';
  }
  return 'late';
}

/**
 * The local hour of `ts` in the session's timezone: from the parts stored on
 * the session when they were computed under that timezone (no `Intl` work),
 * otherwise resolved from the raw stamp.
 */
function getLocalHour(
  session: DrinkingSession,
  ts: number,
  defaultTimezone: string,
): number | undefined {
  const timezone = session.timezone ?? defaultTimezone;
  const stored =
    session.drinksTimeParts?.tz === timezone
      ? session.drinksTimeParts.byTs[ts]
      : undefined;
  if (isStoredLocalParts(stored)) {
    return stored.h;
  }
  try {
    return resolveLocalParts(ts, timezone)?.localHour;
  } catch {
    return undefined;
  }
}

/**
 * The drinks of a session as ranker entries, read through the Sessions v2
 * adapter so legacy buckets and v2 entries rank the same way.
 */
function toRankEntries(
  session: DrinkingSession,
  defaultTimezone: string = CONST.DEFAULT_TIME_ZONE.selected,
): RankEntry[] {
  const hourByTs = new Map<number, number | undefined>();
  return getSessionEntries(session).map(entry => {
    let hour = hourByTs.get(entry.ts);
    if (!hourByTs.has(entry.ts)) {
      hour = getLocalHour(session, entry.ts, defaultTimezone);
      hourByTs.set(entry.ts, hour);
    }
    return {key: entry.key, count: entry.count, ts: entry.ts, hour};
  });
}

function emptyDistribution(): DrinkDistribution {
  return {
    small_beer: 0,
    beer: 0,
    cocktail: 0,
    other: 0,
    strong_shot: 0,
    weak_shot: 0,
    wine: 0,
  };
}

function roundProbability(value: number): number {
  const factor = 10 ** PROBABILITY_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Turn accumulated votes per key into probabilities, with `priorWeight`
 * sessions' worth of `prior` mixed in. With no votes at all this is the prior.
 */
function smooth(
  votes: DrinkDistribution,
  total: number,
  prior: DrinkDistribution,
  priorWeight: number,
): DrinkDistribution {
  const distribution = emptyDistribution();
  for (const key of DRINK_KEY_ORDER) {
    distribution[key] = roundProbability(
      (votes[key] + priorWeight * prior[key]) / (total + priorWeight),
    );
  }
  return distribution;
}

type BuildDrinkProfileOptions = {
  /** The profile's `computed_at`; defaults to now. */
  now?: number;

  /** The timezone for sessions that don't carry one; defaults to the device's. */
  defaultTimezone?: string;
};

/**
 * A user's drink profile from their recent finished sessions. Each session
 * casts one vote, split by the share of each drink in it, and the votes decay
 * by how many sessions ago they were cast. The population prior fills in for a
 * thin history and each part of the day is smoothed toward the overall
 * distribution, so the profile is always complete and one unusual night
 * doesn't upend it.
 */
function buildDrinkProfile(
  sessions: DrinkingSessionList | undefined,
  options: BuildDrinkProfileOptions = {},
): DrinkProfile {
  const {now = Date.now(), defaultTimezone = CONST.DEFAULT_TIME_ZONE.selected} =
    options;
  const recentSessions = Object.values(sessions ?? {})
    .filter(
      (session): session is DrinkingSession =>
        !!session &&
        session.ongoing !== true &&
        Number.isFinite(session.start_time),
    )
    .sort((a, b) => b.start_time - a.start_time)
    .slice(0, SESSION_WINDOW);

  const overallVotes = emptyDistribution();
  let overallTotal = 0;
  const bucketVotes: Record<TimeBucket, DrinkDistribution> = {
    day: emptyDistribution(),
    evening: emptyDistribution(),
    night: emptyDistribution(),
    late: emptyDistribution(),
  };
  const bucketTotals: Record<TimeBucket, number> = {
    day: 0,
    evening: 0,
    night: 0,
    late: 0,
  };
  let sessionCount = 0;
  let weight = 1;
  for (const session of recentSessions) {
    const entries = toRankEntries(session, defaultTimezone);
    const drinkTotal = entries.reduce((sum, entry) => sum + entry.count, 0);
    if (drinkTotal <= 0) {
      // A session without drinks casts no vote and doesn't age the others.
      continue;
    }
    for (const entry of entries) {
      const vote = (weight * entry.count) / drinkTotal;
      overallVotes[entry.key] += vote;
      if (entry.hour !== undefined) {
        const bucket = getTimeBucket(entry.hour);
        bucketVotes[bucket][entry.key] += vote;
        bucketTotals[bucket] += vote;
      }
    }
    overallTotal += weight;
    sessionCount += 1;
    weight *= SESSION_DECAY;
  }

  const overall = smooth(
    overallVotes,
    overallTotal,
    POPULATION_PRIOR,
    PRIOR_WEIGHT,
  );
  const smoothBucket = (bucket: TimeBucket): DrinkDistribution =>
    smooth(
      bucketVotes[bucket],
      bucketTotals[bucket],
      overall,
      BUCKET_PRIOR_WEIGHT,
    );
  return {
    schema_version: 1,
    computed_at: now,
    session_count: sessionCount,
    overall,
    by_bucket: {
      day: smoothBucket('day'),
      evening: smoothBucket('evening'),
      night: smoothBucket('night'),
      late: smoothBucket('late'),
    },
  };
}

/**
 * The drink logged most recently in a session: at the newest drink time, the
 * key with the most drinks (ties keep the drink order). Undefined when the
 * session has no drinks.
 */
function getLatestDrinkKey(
  session: DrinkingSession | undefined,
): DrinkKey | undefined {
  const entries = getSessionEntries(session);
  if (entries.length === 0) {
    return undefined;
  }
  // Entries are sorted by time, so the last one carries the newest time.
  const latestTs = entries[entries.length - 1].ts;
  const countByKey = new Map<DrinkKey, number>();
  for (let i = entries.length - 1; i >= 0 && entries[i].ts === latestTs; i--) {
    const {key, count} = entries[i];
    countByKey.set(key, (countByKey.get(key) ?? 0) + count);
  }
  let latest: {key: DrinkKey; count: number} | undefined;
  for (const key of DRINK_KEY_ORDER) {
    const count = countByKey.get(key) ?? 0;
    if (count > 0 && (!latest || count > latest.count)) {
      latest = {key, count};
    }
  }
  return latest?.key;
}

/**
 * The drink types in the order the quick-add row shows them: the profile's
 * order for the part of the day the session started in, with the drink logged
 * most recently in this session moved to the front. The base order follows the
 * session's start rather than the current time, so it holds for the whole
 * session; only the front chip changes, and only when the user logs a
 * different drink.
 */
function rankQuickAdd(
  profile: DrinkProfile,
  session?: DrinkingSession,
  defaultTimezone: string = CONST.DEFAULT_TIME_ZONE.selected,
): DrinkKey[] {
  const startHour = session
    ? getLocalHour(session, session.start_time, defaultTimezone)
    : undefined;
  const distribution =
    startHour === undefined
      ? profile.overall
      : profile.by_bucket[getTimeBucket(startHour)];
  const ranked = [...DRINK_KEY_ORDER].sort(
    (a, b) =>
      distribution[b] - distribution[a] ||
      DRINK_KEY_ORDER.indexOf(a) - DRINK_KEY_ORDER.indexOf(b),
  );
  const latest = getLatestDrinkKey(session);
  if (!latest) {
    return ranked;
  }
  return [latest, ...ranked.filter(key => key !== latest)];
}

export {
  BUCKET_PRIOR_WEIGHT,
  POPULATION_PRIOR,
  PRIOR_WEIGHT,
  SESSION_DECAY,
  SESSION_WINDOW,
  TIME_BUCKETS,
  buildDrinkProfile,
  getLatestDrinkKey,
  getTimeBucket,
  rankQuickAdd,
  toRankEntries,
};
export type {BuildDrinkProfileOptions};
