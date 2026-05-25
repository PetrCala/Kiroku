import type {Reducer} from './aggregate';
import type {DrinkEvent} from './types';

/**
 * Linear-interpolation percentile over sorted `values`. Returns 0 for an
 * empty input. Matches numpy's `linear` interpolation mode so test fixtures
 * can be cross-checked against any standard reference.
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0];
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) {
    return sorted[lo];
  }
  const weight = rank - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

const sumUnits: Reducer<number> = events => {
  let total = 0;
  for (const event of events) {
    total += event.units;
  }
  return total;
};

const sumSdu: Reducer<number> = events => {
  let total = 0;
  for (const event of events) {
    total += event.sdu ?? 0;
  }
  return total;
};

const countEvents: Reducer<number> = events => events.length;

const countSessions: Reducer<number> = events => {
  const ids = new Set<string>();
  for (const event of events) {
    ids.add(event.sessionId);
  }
  return ids.size;
};

const countDays: Reducer<number> = events => {
  const days = new Set<string>();
  for (const event of events) {
    days.add(event.localDay);
  }
  return days.size;
};

const meanUnits: Reducer<number> = events => {
  if (events.length === 0) {
    return 0;
  }
  return sumUnits(events) / events.length;
};

const medianUnits: Reducer<number> = events =>
  percentile(
    events.map(event => event.units),
    0.5,
  );

const p25: Reducer<number> = events =>
  percentile(
    events.map(event => event.units),
    0.25,
  );

const p75: Reducer<number> = events =>
  percentile(
    events.map(event => event.units),
    0.75,
  );

const p90: Reducer<number> = events =>
  percentile(
    events.map(event => event.units),
    0.9,
  );

/**
 * Population standard deviation of `units`. Returns 0 for empty or
 * single-element buckets — sample stddev would be undefined / division by
 * zero, and chart code prefers a numeric zero to a NaN sentinel.
 */
const stddev: Reducer<number> = events => {
  if (events.length <= 1) {
    return 0;
  }
  const mean = meanUnits(events);
  let sumSquares = 0;
  for (const event of events) {
    const delta = event.units - mean;
    sumSquares += delta * delta;
  }
  return Math.sqrt(sumSquares / events.length);
};

/**
 * Session length in minutes. Every event in a session bucket shares the same
 * `sessionDurationMin`, so reading the first event is sufficient. Returns
 * `NaN` for buckets whose session has no resolvable duration (ongoing,
 * unended); callers must filter NaN before binning.
 */
const sessionDurationMin: Reducer<number> = events =>
  events[0]?.sessionDurationMin ?? Number.NaN;

const firstEvent: Reducer<DrinkEvent | undefined> = events => {
  if (events.length === 0) {
    return undefined;
  }
  let earliest = events[0];
  for (let i = 1; i < events.length; i++) {
    if (events[i].ts < earliest.ts) {
      earliest = events[i];
    }
  }
  return earliest;
};

const lastEvent: Reducer<DrinkEvent | undefined> = events => {
  if (events.length === 0) {
    return undefined;
  }
  let latest = events[0];
  for (let i = 1; i < events.length; i++) {
    if (events[i].ts > latest.ts) {
      latest = events[i];
    }
  }
  return latest;
};

export {
  countDays,
  countEvents,
  countSessions,
  firstEvent,
  lastEvent,
  meanUnits,
  medianUnits,
  p25,
  p75,
  p90,
  percentile,
  sessionDurationMin,
  stddev,
  sumSdu,
  sumUnits,
};
