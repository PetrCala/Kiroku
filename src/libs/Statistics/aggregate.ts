import type {DrinkEvent} from './types';

/**
 * Maps a `DrinkEvent` to the key it belongs under in an aggregation.
 * Bucketers MUST return a value usable as a `Map` key (primitives only —
 * tuples won't structurally compare; use {@link composeBuckets} which
 * serialises composite keys to strings).
 */
type Bucketer<TKey> = (event: DrinkEvent) => TKey;

/**
 * Reduces a per-bucket array of events to its summary value. Takes the full
 * array (not an accumulator) so percentile/median/stddev reducers see every
 * sample.
 */
type Reducer<TAgg> = (events: DrinkEvent[]) => TAgg;

/** Predicate applied before bucketing. */
type EventFilter = (event: DrinkEvent) => boolean;

/**
 * Group events by `bucketer` and apply `reducer` to each bucket. Optional
 * `filter` runs first so excluded events never enter a bucket.
 *
 * Pure. Two passes: bucket the events into a working `Map<TKey, DrinkEvent[]>`,
 * then reduce each bucket. Allocating arrays per bucket is the price of
 * supporting reducers that need the full sample (median, percentiles, stddev).
 */
function aggregate<TKey, TAgg>(
  events: readonly DrinkEvent[],
  bucketer: Bucketer<TKey>,
  reducer: Reducer<TAgg>,
  filter?: EventFilter,
): Map<TKey, TAgg> {
  const buckets = new Map<TKey, DrinkEvent[]>();
  for (const event of events) {
    if (filter && !filter(event)) {
      continue;
    }
    const key = bucketer(event);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(event);
    } else {
      buckets.set(key, [event]);
    }
  }
  const out = new Map<TKey, TAgg>();
  for (const [key, bucket] of buckets) {
    out.set(key, reducer(bucket));
  }
  return out;
}

export default aggregate;
export type {Bucketer, EventFilter, Reducer};
