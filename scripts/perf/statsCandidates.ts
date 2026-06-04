/* eslint-disable no-bitwise */
/**
 * Benchmark + correctness candidates for `buildDrinkEvents`.
 *
 * This module is NOT shipped (it lives under `scripts/`) and is imported by
 * both the ts-node benchmark (`statsEventsBench.ts`) and the jest correctness
 * suite (`__tests__/unit/libs/Statistics/eventsCandidates.test.ts`). Every
 * candidate keeps the exact public signature of `buildDrinkEvents` and emits
 * the identical `DrinkEvent` shape, so they are drop-in comparable.
 *
 *   (a) baseline      — the shipped implementation (1 formatToParts / timestamp
 *                       + Date-based ISO-week + DOW). Re-exported, not copied.
 *   (b) day-bucket    — one Intl probe per distinct local day (plus a cheap
 *                       transition probe); same-day timestamps derive the hour
 *                       arithmetically. Full formatToParts only on the ≤2
 *                       DST-transition days per year.
 *   (c) offset-table  — per-zone offset-transition table built with a handful
 *                       of Intl probes; every timestamp then resolves with pure
 *                       integer arithmetic (zero Intl in steady state).
 */
import './benchGlobals';
import buildBaselineImpl from '@libs/Statistics/events';
import {sduFrom} from '@libs/Statistics/sdu';
import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type DrinkingSession from '@src/types/onyx/DrinkingSession';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {DrinkEvent, WeekStart} from '@libs/Statistics/types';

type DrinkDefaults = Partial<Record<DrinkKey, {ml: number; abv: number}>>;

type BuildDrinkEvents = (
  sessions: UserDrinkingSessionsList | undefined,
  drinksToUnits: DrinksToUnits | undefined,
  drinkDefaults: DrinkDefaults | undefined,
  timezone: SelectedTimezone,
  weekStart: WeekStart,
) => DrinkEvent[];

// ───────────────────────────── shared internals ─────────────────────────────

type NormalizedEntry = {count: number; volumeMl?: number; abv?: number};

function normalizeEntry(raw: unknown): NormalizedEntry | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) {
      return null;
    }
    return {count: raw};
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as {count?: unknown; volume_ml?: unknown; abv?: unknown};
    const count =
      typeof obj.count === 'number' &&
      Number.isFinite(obj.count) &&
      obj.count > 0
        ? obj.count
        : null;
    if (count === null) {
      return null;
    }
    const volumeMl =
      typeof obj.volume_ml === 'number' && Number.isFinite(obj.volume_ml)
        ? obj.volume_ml
        : undefined;
    const abv =
      typeof obj.abv === 'number' && Number.isFinite(obj.abv)
        ? obj.abv
        : undefined;
    return {count, volumeMl, abv};
  }
  return null;
}

function computeSdu(
  entry: NormalizedEntry,
  defaults: {ml: number; abv: number} | undefined,
): number | undefined {
  const ml = entry.volumeMl ?? defaults?.ml;
  const abv = entry.abv ?? defaults?.abv;
  if (ml === undefined || abv === undefined) {
    return undefined;
  }
  return sduFrom(ml, abv) * entry.count;
}

// ─────────────────────── pure proleptic-Gregorian math ───────────────────────
// Howard Hinnant's days<->civil algorithms. Operate on "days since 1970-01-01".

/** Days since the Unix epoch for a Y/M/D (Gregorian). */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of {@link daysFromCivil}: [year, month, day] from days since epoch. */
function civilFromDays(z: number): [number, number, number] {
  const zz = z + 719468;
  const era = Math.floor((zz >= 0 ? zz : zz - 146096) / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [y + (m <= 2 ? 1 : 0), m, d];
}

const D2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** ISO-8601 week label from a day-count, matching the baseline's output. */
function isoWeekLabelFromDays(dayCount: number): string {
  const calendarDow = ((((dayCount % 7) + 4) % 7) + 7) % 7; // 0=Sun..6=Sat
  const dayFromMonday = (calendarDow + 6) % 7;
  const thursdayDays = dayCount - dayFromMonday + 3;
  const [isoYear] = civilFromDays(thursdayDays);
  const jan4 = daysFromCivil(isoYear, 1, 4);
  const jan4Dow = ((((jan4 % 7) + 4) % 7) + 7) % 7;
  const firstOffset = (jan4Dow + 6) % 7;
  const firstThursdayDays = jan4 - firstOffset + 3;
  const week = 1 + Math.round((thursdayDays - firstThursdayDays) / 7);
  return `${String(isoYear).padStart(4, '0')}-W${D2(week)}`;
}

type LocalParts = {
  localDay: string;
  localMonth: string;
  localHour: number;
  localIsoWeek: string;
  calendarDow: number;
};

/** Build the per-day bundle (everything except the hour) from a day-count. */
function bundleFromDayCount(dayCount: number): Omit<LocalParts, 'localHour'> {
  const [y, m, d] = civilFromDays(dayCount);
  const calendarDow = ((((dayCount % 7) + 4) % 7) + 7) % 7;
  return {
    localDay: `${String(y).padStart(4, '0')}-${D2(m)}-${D2(d)}`,
    localMonth: `${String(y).padStart(4, '0')}-${D2(m)}`,
    localIsoWeek: isoWeekLabelFromDays(dayCount),
    calendarDow,
  };
}

// One full `Intl` formatter per zone, used to probe offsets.
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function getOffsetFormatter(tz: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    offsetFormatters.set(tz, f);
  }
  return f;
}

/**
 * Whole-second UTC offset for `ts` in `tz`, via one full Intl probe.
 * `localWallSecond - utcSecond`. Robust for half-hour / 45-minute zones.
 */
function offsetSecondsAt(ts: number, tz: string): number {
  const fields: Record<string, string> = {};
  for (const part of getOffsetFormatter(tz).formatToParts(ts)) {
    fields[part.type] = part.value;
  }
  const y = Number(fields.year);
  const mo = Number(fields.month);
  const d = Number(fields.day);
  const h = Number(fields.hour) % 24;
  const mi = Number(fields.minute);
  const s = Number(fields.second);
  const localWallSec = daysFromCivil(y, mo, d) * 86400 + h * 3600 + mi * 60 + s;
  const utcSec = Math.floor(ts / 1000);
  return localWallSec - utcSec;
}

/** Derive all local fields from a UTC `ts` and a known whole-second offset. */
function partsFromOffset(ts: number, offsetSec: number): LocalParts {
  const localMs = ts + offsetSec * 1000;
  const dayCount = Math.floor(localMs / 86400000);
  const secOfDay = Math.floor((localMs - dayCount * 86400000) / 1000);
  const bundle = bundleFromDayCount(dayCount);
  return {...bundle, localHour: Math.floor(secOfDay / 3600)};
}

// ───────────────────────────── (b) day-bucket ───────────────────────────────

/**
 * One Intl probe per distinct local day. On entering a new day we probe the
 * offset, then probe the offset at the day's far edge: if they agree the whole
 * local day shares one offset and same-day timestamps resolve by arithmetic; if
 * they disagree (a DST-transition day, ≤2/year) we fall back to a per-timestamp
 * full probe so the boundary stays exact.
 */
function makeDayBucketResolver() {
  type Cache = {
    tz: string;
    dayStartUtc: number;
    dayEndUtc: number;
    offsetSec: number;
    transitionDay: boolean;
    bundle: Omit<LocalParts, 'localHour'>;
  };
  let cache: Cache | null = null;

  return function resolve(ts: number, tz: string): LocalParts {
    if (
      cache &&
      cache.tz === tz &&
      ts >= cache.dayStartUtc &&
      ts < cache.dayEndUtc
    ) {
      if (cache.transitionDay) {
        return partsFromOffset(ts, offsetSecondsAt(ts, tz));
      }
      const localMs = ts + cache.offsetSec * 1000;
      const dayCount = Math.floor(localMs / 86400000);
      const secOfDay = Math.floor((localMs - dayCount * 86400000) / 1000);
      return {...cache.bundle, localHour: Math.floor(secOfDay / 3600)};
    }

    const offsetSec = offsetSecondsAt(ts, tz);
    const localMs = ts + offsetSec * 1000;
    const dayCount = Math.floor(localMs / 86400000);
    const dayStartUtc = dayCount * 86400000 - offsetSec * 1000;
    const dayEndUtc = dayStartUtc + 86400000;
    // Probe the far edge to detect an intra-day transition cheaply.
    const offsetAtEnd = offsetSecondsAt(dayEndUtc - 1000, tz);
    const transitionDay = offsetAtEnd !== offsetSec;
    const bundle = bundleFromDayCount(dayCount);
    cache = {
      tz,
      dayStartUtc,
      dayEndUtc,
      offsetSec,
      transitionDay,
      bundle,
    };
    if (transitionDay) {
      return partsFromOffset(ts, offsetSecondsAt(ts, tz));
    }
    const secOfDay = Math.floor((localMs - dayCount * 86400000) / 1000);
    return {...bundle, localHour: Math.floor(secOfDay / 3600)};
  };
}

// ───────────────────────────── (c) offset-table ─────────────────────────────

type OffsetTable = {
  tz: string;
  lo: number;
  hi: number;
  // Parallel sorted arrays: boundary[i] is the first UTC ms at which offset[i]
  // applies; offset[i] holds until boundary[i+1].
  boundary: number[];
  offset: number[];
};

// Scan step for locating transitions. Must be shorter than the shortest gap
// between two consecutive offset transitions for every zone we resolve. DST
// dwell is ≥ ~4 months for the supported zones; 8 days is comfortably safe and
// keeps the probe budget tiny (≈ range/8d Intl calls, once per zone).
const SCAN_STEP_MS = 8 * 86400000;

/** Binary-search the exact transition instant in (loTs, hiTs] to ms precision. */
function findTransition(
  loTs: number,
  loOff: number,
  hiTs: number,
  tz: string,
): {at: number; off: number} {
  let lo = loTs;
  let hi = hiTs;
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (offsetSecondsAt(mid, tz) === loOff) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return {at: hi, off: offsetSecondsAt(hi, tz)};
}

function computeOffsetTable(tz: string, lo: number, hi: number): OffsetTable {
  const boundary: number[] = [];
  const offset: number[] = [];
  let prevOff = offsetSecondsAt(lo, tz);
  boundary.push(lo);
  offset.push(prevOff);
  let cursor = lo;
  while (cursor < hi) {
    const next = Math.min(cursor + SCAN_STEP_MS, hi);
    const nextOff = offsetSecondsAt(next, tz);
    if (nextOff !== prevOff) {
      // A transition lies in (cursor, next]; pin it exactly, then continue
      // from the transition (handles multiple transitions in one step too).
      let segLo = cursor;
      let segLoOff = prevOff;
      // Loop in case the step straddles >1 transition.
      for (;;) {
        const t = findTransition(segLo, segLoOff, next, tz);
        boundary.push(t.at);
        offset.push(t.off);
        prevOff = t.off;
        segLo = t.at;
        segLoOff = t.off;
        if (offsetSecondsAt(next, tz) === t.off) {
          break;
        }
      }
    }
    cursor = next;
  }
  return {tz, lo, hi, boundary, offset};
}

function offsetFromTable(table: OffsetTable, ts: number): number {
  const {boundary, offset} = table;
  // Binary search: last boundary <= ts.
  let lo = 0;
  let hi = boundary.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (boundary[mid] <= ts) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return offset[lo];
}

function makeOffsetTableResolver(globalLo: number, globalHi: number) {
  const tables = new Map<string, OffsetTable>();
  return function resolve(ts: number, tz: string): LocalParts {
    let table = tables.get(tz);
    if (!table) {
      // Pad the range by one scan step so edge timestamps stay covered.
      table = computeOffsetTable(
        tz,
        globalLo - SCAN_STEP_MS,
        globalHi + SCAN_STEP_MS,
      );
      tables.set(tz, table);
    }
    return partsFromOffset(ts, offsetFromTable(table, ts));
  };
}

// ─────────────────── generic builder shared by (b) and (c) ───────────────────

type Resolver = (ts: number, tz: string) => LocalParts;

function buildWithResolver(
  sessions: UserDrinkingSessionsList | undefined,
  drinksToUnits: DrinksToUnits | undefined,
  drinkDefaults: DrinkDefaults | undefined,
  timezone: SelectedTimezone,
  weekStart: WeekStart,
  makeResolver: () => Resolver,
): DrinkEvent[] {
  const events: DrinkEvent[] = [];
  if (!sessions) {
    return events;
  }
  const resolve = makeResolver();
  for (const userId of Object.keys(sessions)) {
    const userSessions = sessions[userId];
    if (!userSessions) {
      continue;
    }
    for (const sessionId of Object.keys(userSessions)) {
      const session: DrinkingSession | undefined = userSessions[sessionId];
      if (!session || session.ongoing === true) {
        continue;
      }
      const startMs = Number(session.start_time);
      if (!Number.isFinite(startMs)) {
        continue;
      }
      const sessionTz = session.timezone ?? timezone;
      const sessionDurationMin =
        typeof session.end_time === 'number' &&
        Number.isFinite(session.end_time)
          ? (session.end_time - startMs) / 60000
          : undefined;
      const blackoutSession = session.blackout === true;
      const drinks: DrinksList | undefined = session.drinks;
      if (!drinks) {
        continue;
      }
      for (const [tsKey, drinksAtTs] of Object.entries(drinks)) {
        const ts = Number(tsKey);
        if (!Number.isFinite(ts) || !drinksAtTs) {
          continue;
        }
        let parts: LocalParts | null;
        try {
          parts = resolve(ts, sessionTz);
        } catch {
          continue;
        }
        if (!parts) {
          continue;
        }
        const {localDay, localMonth, localHour, localIsoWeek, calendarDow} =
          parts;
        const localDow = (calendarDow - weekStart + 7) % 7;
        const isWeekend = calendarDow === 0 || calendarDow === 6;
        for (const drinkKeyRaw of Object.keys(drinksAtTs)) {
          const drinkKey = drinkKeyRaw as DrinkKey;
          const entry = normalizeEntry(
            (drinksAtTs as Record<string, unknown>)[drinkKey],
          );
          if (!entry) {
            continue;
          }
          const unitsPerDrink = drinksToUnits?.[drinkKey] ?? 0;
          const units = entry.count * unitsPerDrink;
          const sdu = computeSdu(entry, drinkDefaults?.[drinkKey]);
          events.push({
            userId,
            sessionId,
            ts,
            localDay,
            localIsoWeek,
            localMonth,
            localHour,
            localDow,
            isWeekend,
            drinkKey,
            count: entry.count,
            units,
            sdu,
            blackoutSession,
            sessionDurationMin,
          });
        }
      }
    }
  }
  return events;
}

/** Global min/max timestamp scan — feeds the (c) offset table range. */
function tsRange(
  sessions: UserDrinkingSessionsList | undefined,
): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  if (!sessions) {
    return [0, 0];
  }
  for (const userId of Object.keys(sessions)) {
    const us = sessions[userId];
    if (!us) {
      continue;
    }
    for (const sid of Object.keys(us)) {
      const drinks = us[sid]?.drinks;
      if (!drinks) {
        continue;
      }
      for (const k of Object.keys(drinks)) {
        const ts = Number(k);
        if (Number.isFinite(ts)) {
          if (ts < lo) {
            lo = ts;
          }
          if (ts > hi) {
            hi = ts;
          }
        }
      }
    }
  }
  if (!Number.isFinite(lo)) {
    return [0, 0];
  }
  return [lo, hi];
}

// ─────────────────── frozen original baseline (for the bench) ────────────────
// A faithful copy of the pre-(c) shipped implementation: one cached
// `formatToParts` per timestamp + Date-based ISO-week/DOW. Kept independent of
// whatever ships in events.ts so the benchmark's "(a) baseline" column stays a
// stable before/after reference even after a candidate is adopted.

const frozenFormatters = new Map<string, Intl.DateTimeFormat>();
function frozenFormatter(tz: string): Intl.DateTimeFormat {
  let f = frozenFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    frozenFormatters.set(tz, f);
  }
  return f;
}

function frozenIsoWeekLabel(localMidnightUtc: number): string {
  const thursday = new Date(localMidnightUtc);
  const dayFromMonday = (thursday.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - dayFromMonday + 3);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstOffset = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstOffset + 3);
  const week =
    1 +
    Math.round((thursday.getTime() - firstThursday.getTime()) / 604_800_000);
  return `${String(isoYear).padStart(4, '0')}-W${D2(week)}`;
}

function frozenResolver(): Resolver {
  return function resolve(ts: number, tz: string): LocalParts {
    const fields: Record<string, string> = {};
    for (const part of frozenFormatter(tz).formatToParts(ts)) {
      fields[part.type] = part.value;
    }
    const {year, month, day, hour} = fields;
    const localMidnightUtc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
    );
    return {
      localDay: `${year}-${month}-${day}`,
      localMonth: `${year}-${month}`,
      localHour: Number(hour) % 24,
      localIsoWeek: frozenIsoWeekLabel(localMidnightUtc),
      calendarDow: new Date(localMidnightUtc).getUTCDay(),
    };
  };
}

const buildBaselineFrozen: BuildDrinkEvents = (
  sessions,
  drinksToUnits,
  drinkDefaults,
  timezone,
  weekStart,
) =>
  buildWithResolver(
    sessions,
    drinksToUnits,
    drinkDefaults,
    timezone,
    weekStart,
    frozenResolver,
  );

// ───────────────────────────── public candidates ────────────────────────────

// Tracks whatever ships in events.ts — the correctness suite validates this.
const buildBaseline: BuildDrinkEvents = buildBaselineImpl;

const buildDayBucket: BuildDrinkEvents = (
  sessions,
  drinksToUnits,
  drinkDefaults,
  timezone,
  weekStart,
) =>
  buildWithResolver(
    sessions,
    drinksToUnits,
    drinkDefaults,
    timezone,
    weekStart,
    makeDayBucketResolver,
  );

const buildOffsetTable: BuildDrinkEvents = (
  sessions,
  drinksToUnits,
  drinkDefaults,
  timezone,
  weekStart,
) => {
  const [lo, hi] = tsRange(sessions);
  return buildWithResolver(
    sessions,
    drinksToUnits,
    drinkDefaults,
    timezone,
    weekStart,
    () => makeOffsetTableResolver(lo, hi),
  );
};

type Candidate = {key: string; label: string; fn: BuildDrinkEvents};

const CANDIDATES: Candidate[] = [
  {key: 'a', label: '(a) baseline cached-formatter', fn: buildBaselineFrozen},
  {key: 'b', label: '(b) day-bucket memo', fn: buildDayBucket},
  {key: 'c', label: '(c) offset-table arithmetic', fn: buildOffsetTable},
];

export {
  buildBaseline,
  buildBaselineFrozen,
  buildDayBucket,
  buildOffsetTable,
  CANDIDATES,
  // exported for the benchmark's segment profiler / sanity checks
  offsetSecondsAt,
  partsFromOffset,
  daysFromCivil,
  civilFromDays,
  isoWeekLabelFromDays,
};
export type {BuildDrinkEvents, Candidate, DrinkDefaults};
