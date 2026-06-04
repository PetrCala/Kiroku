/**
 * Deterministic synthetic-dataset generator for the Statistics benchmarks.
 * Produces realistic `UserDrinkingSessionsList` shapes: near-daily sessions
 * over an N-year span, 1–8 drink timestamps per session, several drink types
 * per timestamp. Seeded so every run is byte-for-byte reproducible.
 */
import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {DrinkDefaults} from './statsCandidates';

/* eslint-disable no-bitwise, operator-assignment */
/** mulberry32 — tiny, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise, operator-assignment */

const DRINK_KEYS: DrinkKey[] = [
  'small_beer',
  'beer',
  'cocktail',
  'other',
  'strong_shot',
  'weak_shot',
  'wine',
];

const UNITS: DrinksToUnits = {
  small_beer: 0.5,
  beer: 1,
  cocktail: 1.5,
  other: 1,
  strong_shot: 1,
  weak_shot: 0.5,
  wine: 1.5,
};

const DEFAULTS: DrinkDefaults = {
  small_beer: {ml: 330, abv: 0.05},
  beer: {ml: 500, abv: 0.05},
  cocktail: {ml: 250, abv: 0.1},
  other: {ml: 200, abv: 0.1},
  strong_shot: {ml: 40, abv: 0.4},
  weak_shot: {ml: 40, abv: 0.2},
  wine: {ml: 150, abv: 0.12},
};

type GenOptions = {
  years: number;
  /** Fraction of days that have a session (near-daily ≈ 0.85). */
  sessionDensity: number;
  /** Drink timestamps per session: minTimestamps..maxTimestamps, uniform. */
  minTimestamps?: number;
  maxTimestamps: number;
  /** Distinct drink types per timestamp: minTypes..maxTypes, uniform. */
  minTypes?: number;
  maxTypes: number;
  /** Probability an entry uses the v2-A object shape with overrides. */
  v2Fraction: number;
  timezone: SelectedTimezone;
  seed: number;
  /** End of the data window (defaults to a fixed date for reproducibility). */
  endMs?: number;
};

type GenResult = {
  sessions: UserDrinkingSessionsList;
  sessionCount: number;
  eventCount: number;
  options: GenOptions;
};

const DAY = 86400000;
const DEFAULT_END = Date.UTC(2025, 0, 1, 0, 0, 0); // fixed anchor

function generateDataset(opts: GenOptions): GenResult {
  const rand = mulberry32(opts.seed);
  const end = opts.endMs ?? DEFAULT_END;
  const totalDays = Math.round(opts.years * 365);
  const start = end - totalDays * DAY;

  const userSessions: Record<string, ReturnType<typeof makeSession>> = {};
  let sessionCount = 0;
  let eventCount = 0;

  function makeSession(dayStart: number) {
    // Session begins somewhere in the evening, runs 1–5h.
    const startOffset = (16 + Math.floor(rand() * 7)) * 3600000; // 16:00–22:00
    const startTime = dayStart + startOffset + Math.floor(rand() * 3600000);
    const durationMin = 30 + Math.floor(rand() * 270);
    const endTime = startTime + durationMin * 60000;
    const minTs = opts.minTimestamps ?? 1;
    const minTy = opts.minTypes ?? 1;
    const nTs = minTs + Math.floor(rand() * (opts.maxTimestamps - minTs + 1));
    // Keyed by stringified ms; cast to DrinksList at return (the runtime shape
    // matches — DrinksList's numeric index is just string keys at runtime).
    const drinks: Record<string, unknown> = {};
    for (let i = 0; i < nTs; i++) {
      const ts = startTime + Math.floor(rand() * (endTime - startTime) * 0.98);
      const nTypes = minTy + Math.floor(rand() * (opts.maxTypes - minTy + 1));
      const entry: Record<string, unknown> = {};
      const used = new Set<number>();
      for (let j = 0; j < nTypes; j++) {
        let idx = Math.floor(rand() * DRINK_KEYS.length);
        if (used.has(idx)) {
          idx = (idx + 1) % DRINK_KEYS.length;
        }
        used.add(idx);
        const key = DRINK_KEYS[idx];
        const count = 1 + Math.floor(rand() * 4);
        if (rand() < opts.v2Fraction) {
          entry[key] = {
            count,
            volume_ml: 150 + Math.floor(rand() * 350),
            abv: 0.04 + rand() * 0.1,
          };
        } else {
          entry[key] = count;
        }
        eventCount += 1;
      }
      // Distinct ms keys; collisions are vanishingly unlikely but guarded.
      drinks[String(ts + i)] = entry;
    }
    return {
      start_time: startTime,
      end_time: endTime,
      timezone: opts.timezone,
      blackout: rand() < 0.1,
      drinks: drinks as unknown as DrinksList,
    };
  }

  for (let d = 0; d < totalDays; d++) {
    if (rand() > opts.sessionDensity) {
      continue;
    }
    const dayStart = start + d * DAY;
    const sid = `s${d}`;
    userSessions[sid] = makeSession(dayStart);
    sessionCount += 1;
  }

  const sessions = {user1: userSessions} as unknown as UserDrinkingSessionsList;
  return {sessions, sessionCount, eventCount, options: opts};
}

/** The three canonical sizes, tuned to land near 1k / 10k / 50k events. */
function standardDatasets(
  timezone: SelectedTimezone = 'Europe/London' as SelectedTimezone,
): Record<'small' | 'medium' | 'large', GenResult> {
  return {
    // ~1 year near-daily, ~1k events
    small: generateDataset({
      years: 1,
      sessionDensity: 0.85,
      minTimestamps: 1,
      maxTimestamps: 3,
      minTypes: 1,
      maxTypes: 3,
      v2Fraction: 0.3,
      timezone,
      seed: 1,
    }),
    // ~3 years near-daily, ~10k events
    medium: generateDataset({
      years: 3,
      sessionDensity: 0.9,
      minTimestamps: 1,
      maxTimestamps: 6,
      minTypes: 2,
      maxTypes: 5,
      v2Fraction: 0.3,
      timezone,
      seed: 2,
    }),
    // ~5 years near-daily, ~50k events
    large: generateDataset({
      years: 5,
      sessionDensity: 0.98,
      minTimestamps: 4,
      maxTimestamps: 8,
      minTypes: 3,
      maxTypes: 6,
      v2Fraction: 0.3,
      timezone,
      seed: 3,
    }),
  };
}

export {generateDataset, standardDatasets, UNITS, DEFAULTS, DRINK_KEYS};
export type {GenOptions, GenResult};
