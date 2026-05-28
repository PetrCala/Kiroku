import type {ChartDatum} from '@libs/Statistics';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkingSessionType} from '@src/types/onyx';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import {getDrinkAbv, getDrinkCount, getDrinkVolumeMl} from './DrinkEntryUtils';
import {isDrinkTypeKey} from './DrinkingSessionUtils';
import {roundToTwoDecimalPlaces} from './NumberUtils';

/** Density of pure ethanol in g/ml. */
const ETHANOL_DENSITY = 0.789;

/** Alcohol elimination rate in BAC percent per hour (zero-order Widmark). */
const ELIMINATION_RATE = 0.015;

/** Widmark distribution factor (r) per gender. `other`/unknown uses the male-female average. */
const WIDMARK_FACTOR_MALE = 0.68;
const WIDMARK_FACTOR_FEMALE = 0.55;
const WIDMARK_FACTOR_OTHER = 0.615;

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Only sessions whose drinks could still contribute to the current BAC matter.
 * Under zero-order elimination (0.015 %/h) even an implausibly high ~0.36%
 * peak fully decays within ~24h, so a 24h lookback captures every realistic
 * case while keeping the scan cheap.
 */
const LOOKBACK_HOURS = 24;
const LOOKBACK_MS = LOOKBACK_HOURS * MS_PER_HOUR;

/** A single drink type's contribution within one session, aggregated for display. */
type DrinkContribution = {
  /** The drink type key (e.g. `beer`). */
  key: DrinkKey;
  /** Total number of drinks of this type/volume/abv combination. */
  count: number;
  /** Per-drink volume in millilitres. */
  volumeMl: number;
  /** Per-drink ABV as a fraction (e.g. 0.05 for 5%). */
  abv: number;
  /** Grams of pure ethanol contributed by this row. */
  grams: number;
};

/** One session's contribution to the aggregate estimate, for the breakdown modal. */
type SessionContribution = {
  /** Session id (or a synthetic key for the ongoing session). */
  sessionId: string;
  /** The session type, defaulting to `live` when unset on legacy data. */
  type: DrinkingSessionType;
  /** Whether drink timing is uncertain (edited session — see {@link estimateBac}). */
  isEdit: boolean;
  /** Session start (UNIX ms). */
  startTime: number;
  /** Resolved session end (UNIX ms): `end_time`, else `now` when ongoing, else `start_time`. */
  endTime: number;
  /** Whether the session is still in progress. */
  ongoing: boolean;
  /** Total grams of pure ethanol in the session. */
  totalGrams: number;
  /** Peak BAC this session would add at full absorption, before any decay. */
  peakBac: number;
  /** Per-drink-type breakdown. */
  drinks: DrinkContribution[];
};

/**
 * Aggregate BAC estimate across every recent session.
 *
 * `low`/`high` form a confidence band driven by edited sessions, whose drinks
 * are all bucketed at the session start (their real consumption time is
 * unknown). The band collapses to a point (`low === high`) when only live
 * sessions — which stamp each drink at its true epoch — contribute.
 */
type BacEstimate = {
  /** Lower bound: edited-session drinks assumed consumed as early as plausible. */
  low: number;
  /** Upper bound: edited-session drinks assumed consumed as late as plausible. */
  high: number;
  /** Headline value: band midpoint when banded, otherwise the single point. */
  point: number;
  /** True when the band is non-degenerate (`high > low`). */
  hasBand: boolean;
  /** Per-session breakdown of what was counted. */
  contributions: SessionContribution[];
};

/** A drink increment placed on the timeline for the forward simulation. */
type BacEvent = {
  /** When the drink is assumed consumed (UNIX ms). */
  timestamp: number;
  /** BAC this drink adds at full absorption (grams / divisor). */
  bacIncrement: number;
};

/** Widmark distribution factor for a gender string, defaulting to the averaged factor. */
function getWidmarkFactor(gender: string | undefined): number {
  if (gender === CONST.GENDER.MALE) {
    return WIDMARK_FACTOR_MALE;
  }
  if (gender === CONST.GENDER.FEMALE) {
    return WIDMARK_FACTOR_FEMALE;
  }
  return WIDMARK_FACTOR_OTHER;
}

/** Grams of pure ethanol for a single drink-type entry. */
function gramsForEntry(
  key: DrinkKey,
  count: number,
  volumeMl: number,
  abv: number,
): number {
  return volumeMl * abv * ETHANOL_DENSITY * count;
}

/**
 * Aggregate a session's drinks into one row per (type, volume, abv) tuple.
 * Rows with the same key but different per-event overrides stay separate so
 * the breakdown stays faithful; the common all-defaults case collapses to one
 * row per drink type.
 */
function getSessionDrinkBreakdown(
  session: DrinkingSession,
): DrinkContribution[] {
  const byTuple = new Map<string, DrinkContribution>();

  Object.values(session.drinks ?? {}).forEach(drinksAtTimestamp => {
    Object.keys(drinksAtTimestamp).forEach(key => {
      if (!isDrinkTypeKey(key)) {
        return;
      }
      const entry = drinksAtTimestamp[key];
      const count = getDrinkCount(entry);
      if (count <= 0) {
        return;
      }
      const volumeMl = getDrinkVolumeMl(key, entry);
      const abv = getDrinkAbv(key, entry);
      const tupleKey = `${key}|${volumeMl}|${abv}`;
      const existing = byTuple.get(tupleKey);
      if (existing) {
        existing.count += count;
        existing.grams += gramsForEntry(key, count, volumeMl, abv);
      } else {
        byTuple.set(tupleKey, {
          key,
          count,
          volumeMl,
          abv,
          grams: gramsForEntry(key, count, volumeMl, abv),
        });
      }
    });
  });

  return [...byTuple.values()];
}

/** Resolve the latest moment a session's drinks could matter (UNIX ms). */
function getSessionLatestTimestamp(
  session: DrinkingSession,
  now: number,
): number {
  if (session.ongoing) {
    return now;
  }
  if (session.end_time) {
    return session.end_time;
  }
  const drinkTimestamps = Object.keys(session.drinks ?? {})
    .map(Number)
    .filter(timestamp => !Number.isNaN(timestamp));
  return drinkTimestamps.length > 0
    ? Math.max(...drinkTimestamps, session.start_time)
    : session.start_time;
}

/**
 * Walk drink events forward, accumulating BAC and applying zero-order
 * elimination between events (floored at 0 so a sober gap correctly resets the
 * clock), then decay from the last event to `now`. Generalises the
 * single-session Widmark formula: with one session that never hits 0 it
 * reduces to `totalBac - rate * hoursSinceFirstDrink`.
 */
function simulateCurrentBac(events: BacEvent[], now: number): number {
  if (events.length === 0) {
    return 0;
  }
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let bac = 0;
  let lastTimestamp = sorted[0].timestamp;
  sorted.forEach(event => {
    const hours = Math.max(0, (event.timestamp - lastTimestamp) / MS_PER_HOUR);
    bac = Math.max(0, bac - ELIMINATION_RATE * hours);
    bac += event.bacIncrement;
    lastTimestamp = event.timestamp;
  });
  const hoursToNow = Math.max(0, (now - lastTimestamp) / MS_PER_HOUR);
  return Math.max(0, bac - ELIMINATION_RATE * hoursToNow);
}

/**
 * Estimate the current BAC across every session within the lookback window,
 * including the live ongoing session passed in `sessions`.
 *
 * Edited sessions (drinks bucketed at `start_time`) produce a band: the `low`
 * timeline places their drinks at `start_time` (most elapsed decay), the
 * `high` timeline at the session `end_time` (least decay). Live sessions use
 * each drink's true timestamp on both timelines, so they collapse to a point.
 */
function estimateBac(
  sessions: DrinkingSession[],
  weightKg: number | undefined,
  gender: string | undefined,
  now: number = Date.now(),
): BacEstimate {
  const empty: BacEstimate = {
    low: 0,
    high: 0,
    point: 0,
    hasBand: false,
    contributions: [],
  };

  if (!weightKg || weightKg <= 0) {
    return empty;
  }

  const divisor = weightKg * getWidmarkFactor(gender) * 10;
  if (divisor <= 0) {
    return empty;
  }

  const contributions: SessionContribution[] = [];
  const lowEvents: BacEvent[] = [];
  const highEvents: BacEvent[] = [];

  sessions.forEach(session => {
    if (getSessionLatestTimestamp(session, now) < now - LOOKBACK_MS) {
      return;
    }

    const breakdown = getSessionDrinkBreakdown(session);
    const totalGrams = breakdown.reduce((sum, row) => sum + row.grams, 0);
    if (totalGrams <= 0) {
      return;
    }

    const isEdit = session.type === CONST.SESSION.TYPES.EDIT;
    const startTime = session.start_time;
    const endTime = session.end_time ?? (session.ongoing ? now : startTime);

    contributions.push({
      sessionId: session.id ?? String(startTime),
      type: session.type ?? CONST.SESSION.TYPES.LIVE,
      isEdit,
      startTime,
      endTime,
      ongoing: session.ongoing === true,
      totalGrams,
      peakBac: totalGrams / divisor,
      drinks: breakdown,
    });

    Object.entries(session.drinks ?? {}).forEach(
      ([timestampKey, drinksAtTimestamp]) => {
        const bucketTimestamp = Number(timestampKey);
        if (Number.isNaN(bucketTimestamp)) {
          return;
        }
        let bucketGrams = 0;
        Object.keys(drinksAtTimestamp).forEach(key => {
          if (!isDrinkTypeKey(key)) {
            return;
          }
          const entry = drinksAtTimestamp[key];
          const count = getDrinkCount(entry);
          if (count <= 0) {
            return;
          }
          bucketGrams += gramsForEntry(
            key,
            count,
            getDrinkVolumeMl(key, entry),
            getDrinkAbv(key, entry),
          );
        });
        if (bucketGrams <= 0) {
          return;
        }
        const increment = bucketGrams / divisor;
        if (isEdit) {
          lowEvents.push({timestamp: startTime, bacIncrement: increment});
          highEvents.push({timestamp: endTime, bacIncrement: increment});
        } else {
          lowEvents.push({timestamp: bucketTimestamp, bacIncrement: increment});
          highEvents.push({
            timestamp: bucketTimestamp,
            bacIncrement: increment,
          });
        }
      },
    );
  });

  const low = roundToTwoDecimalPlaces(simulateCurrentBac(lowEvents, now));
  const high = roundToTwoDecimalPlaces(simulateCurrentBac(highEvents, now));
  const hasBand = high > low;
  const point = hasBand ? roundToTwoDecimalPlaces((low + high) / 2) : low;

  return {low, high, point, hasBand, contributions};
}

/** Hours until BAC decays to zero from the given value (zero-order). */
function getTimeToSoberHours(bacPercent: number): number {
  if (bacPercent <= 0) {
    return 0;
  }
  return bacPercent / ELIMINATION_RATE;
}

/**
 * Hour-by-hour BAC decline from `bacPercent` to zero, for the decay graph.
 * Returns an empty array when already sober so callers can hide the chart.
 * X is hours from now; the series is linear (zero-order) and ends exactly at 0.
 */
function buildBacDecaySeries(bacPercent: number): ChartDatum[] {
  if (bacPercent <= 0) {
    return [];
  }
  const hoursToSober = getTimeToSoberHours(bacPercent);
  const wholeHours = Math.floor(hoursToSober);
  const data: ChartDatum[] = [];
  for (let hour = 0; hour <= wholeHours; hour++) {
    data.push({
      x: hour,
      y: roundToTwoDecimalPlaces(
        Math.max(0, bacPercent - ELIMINATION_RATE * hour),
      ),
    });
  }
  if (wholeHours < hoursToSober) {
    data.push({x: roundToTwoDecimalPlaces(hoursToSober), y: 0});
  }
  return data;
}

/** Format a BAC percentage for display in the chosen unit. */
function formatBac(
  bacPercent: number,
  displayUnit: string = CONST.BAC.DISPLAY_UNIT.PER_MILLE,
): string {
  const perMille = `${(bacPercent * 10).toFixed(2)}‰`;
  const percent = `${bacPercent.toFixed(2)}%`;
  if (displayUnit === CONST.BAC.DISPLAY_UNIT.PERCENT) {
    return percent;
  }
  if (displayUnit === CONST.BAC.DISPLAY_UNIT.BOTH) {
    return `${perMille} (${percent})`;
  }
  return perMille;
}

export {buildBacDecaySeries, estimateBac, formatBac, getTimeToSoberHours};
export type {BacEstimate, DrinkContribution, SessionContribution};
