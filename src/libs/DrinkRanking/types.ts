import type {DrinkKey} from '@src/types/onyx';

/** A part of the day, by the local hour a drink was logged at. */
type TimeBucket = 'day' | 'evening' | 'night' | 'late';

/** A probability per drink key. The values of one distribution sum to 1. */
type DrinkDistribution = Record<DrinkKey, number>;

/**
 * What a user drinks, as probabilities: overall and per part of the day.
 * `buildDrinkProfile` derives it from their recent sessions and `rankQuickAdd`
 * orders the quick-add row by it. Fields are snake_case because this is the
 * shape the server will write and sync once profiles move server-side.
 */
type DrinkProfile = {
  schema_version: 1;

  /** When the profile was computed, in epoch ms. */
  computed_at: number;

  /** How many sessions fed it; 0 means the population prior alone. */
  session_count: number;

  /** What the user drinks, regardless of the time of day. */
  overall: DrinkDistribution;

  /** What the user drinks in each part of the day. */
  by_bucket: Record<TimeBucket, DrinkDistribution>;
};

/** One drink as the ranker sees it, whatever shape the session stores. */
type RankEntry = {
  key: DrinkKey;

  /** How many of the drink were logged at once. */
  count: number;

  /** When the drink was logged, in epoch ms. */
  ts: number;

  /** The local hour (0 to 23) in the session's timezone, when it resolves. */
  hour: number | undefined;
};

export type {DrinkDistribution, DrinkProfile, RankEntry, TimeBucket};
