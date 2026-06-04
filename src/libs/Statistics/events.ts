import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type DrinkingSession from '@src/types/onyx/DrinkingSession';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import {logBuildDrinkEvents} from './profiling';
import {sduFrom} from './sdu';
import type {DrinkEvent, WeekStart} from './types';

/**
 * Volume/ABV defaults per drink type. Caller supplies — typically
 * `CONST.DRINK_DEFAULTS` once v2-A lands. Passed as a parameter (not
 * imported) so the function stays pure and v2-A can ship independently.
 */
type DrinkDefaults = Partial<Record<DrinkKey, {ml: number; abv: number}>>;

type NormalizedEntry = {
  count: number;
  volumeMl?: number;
  abv?: number;
};

/**
 * Narrow the legacy numeric drink entry and the v2-A object shape into a
 * single internal form. Defensive: rejects non-finite counts, non-positive
 * counts, and malformed object entries — the upstream Onyx data has been
 * touched by multiple app versions, so we cannot trust shape from compile
 * time alone.
 */
function normalizeEntry(raw: unknown): NormalizedEntry | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) {
      return null;
    }
    return {count: raw};
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as {
      count?: unknown;
      volume_ml?: unknown;
      abv?: unknown;
    };
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

/**
 * Compute SDU for a single entry. Returns `undefined` when neither overrides
 * nor defaults yield both an `ml` and an `abv`.
 */
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

/* ── Timezone resolution ──────────────────────────────────────────────────
 *
 * Per-drink timezone resolution dominated the event-stream build: a single
 * `Intl` `formatToParts` per timestamp was ~60% of the pass, and the `Date`
 * allocations behind ISO-week / day-of-week added ~11% more plus the bulk of
 * the GC pressure. Instead, we resolve each session timezone's UTC-offset
 * *transitions* ONCE — a handful of `Intl` probes per zone — into a sorted
 * table, then derive every local field (day, month, hour, ISO week,
 * day-of-week) by pure integer arithmetic with zero `Intl` and zero `Date`
 * allocation per timestamp.
 *
 * This is byte-identical to the formatter path across an exhaustive timezone
 * sweep — half-hour (+5:30) and 45-minute (+5:45) offsets, southern-hemisphere
 * DST, Lord Howe's 30-minute DST, and pre-1970 instants — verified against the
 * native `Intl` oracle in __tests__/unit/libs/Statistics/eventsCandidates.test.ts.
 */

/** One full `Intl` formatter per zone, used only to probe offsets. */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function getOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

// Howard Hinnant's proleptic-Gregorian day<->civil algorithms, operating on
// "days since 1970-01-01". Pure integer math — no `Date` allocation.

function daysFromCivil(y: number, m: number, d: number): number {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

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

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
const pad4 = (n: number): string => String(n).padStart(4, '0');

/** 0=Sunday..6=Saturday for a day-count (1970-01-01 was a Thursday). */
const dowFromDays = (dayCount: number): number =>
  ((((dayCount % 7) + 4) % 7) + 7) % 7;

/**
 * ISO 8601 week label (`RRRR-'W'II`) from a day-count. The week-numbering year
 * and week can both differ from the calendar year at the Dec/Jan boundary —
 * e.g. 2021-01-01 belongs to 2020-W53.
 */
function isoWeekLabelFromDays(dayCount: number): string {
  const dayFromMonday = (dowFromDays(dayCount) + 6) % 7;
  const thursday = dayCount - dayFromMonday + 3;
  const [isoYear] = civilFromDays(thursday);
  const jan4 = daysFromCivil(isoYear, 1, 4);
  const firstOffset = (dowFromDays(jan4) + 6) % 7;
  const firstThursday = jan4 - firstOffset + 3;
  const week = 1 + Math.round((thursday - firstThursday) / 7);
  return `${pad4(isoYear)}-W${pad2(week)}`;
}

type LocalParts = {
  localDay: string;
  localMonth: string;
  localHour: number;
  localIsoWeek: string;
  /** Calendar day of week, 0=Sunday..6=Saturday (weekStart-independent). */
  calendarDow: number;
};

/**
 * Whole-second UTC offset for `ts` in `timeZone`, via one full `Intl` probe:
 * `localWallSecond - utcSecond`. Whole seconds (not minutes) keep half-hour,
 * 45-minute and pre-1970 sub-minute (LMT) offsets exact. Throws on an invalid
 * timezone (the `Intl` constructor does) — the caller skips.
 */
function offsetSecondsAt(ts: number, timeZone: string): number {
  const fields: Record<string, string> = {};
  for (const part of getOffsetFormatter(timeZone).formatToParts(ts)) {
    fields[part.type] = part.value;
  }
  const localWallSec =
    daysFromCivil(
      Number(fields.year),
      Number(fields.month),
      Number(fields.day),
    ) *
      86400 +
    (Number(fields.hour) % 24) * 3600 +
    Number(fields.minute) * 60 +
    Number(fields.second);
  return localWallSec - Math.floor(ts / 1000);
}

/** Derive all local fields from a UTC `ts` and a known whole-second offset. */
function partsFromOffset(ts: number, offsetSec: number): LocalParts {
  const localMs = ts + offsetSec * 1000;
  const dayCount = Math.floor(localMs / 86400000);
  const secOfDay = Math.floor((localMs - dayCount * 86400000) / 1000);
  const [y, m, d] = civilFromDays(dayCount);
  return {
    localDay: `${pad4(y)}-${pad2(m)}-${pad2(d)}`,
    localMonth: `${pad4(y)}-${pad2(m)}`,
    localHour: Math.floor(secOfDay / 3600),
    localIsoWeek: isoWeekLabelFromDays(dayCount),
    calendarDow: dowFromDays(dayCount),
  };
}

/**
 * Per-zone offset-transition table. `boundary[i]` is the first UTC ms at which
 * `offset[i]` (whole seconds) applies; it holds until `boundary[i+1]`.
 */
type OffsetTable = {boundary: number[]; offset: number[]};

/**
 * Scan stride for locating offset transitions. Must be shorter than the gap
 * between any two consecutive transitions in the covered range — drink
 * timestamps are recent, where every IANA zone keeps transitions months apart,
 * so 8 days carries a wide safety margin while keeping the probe budget tiny
 * (≈ range / 8d `Intl` calls, once per zone).
 */
const SCAN_STEP_MS = 8 * 86400000;

/** Binary-search the exact transition instant in (loTs, hiTs] to ms precision. */
function findTransition(
  loTs: number,
  loOff: number,
  hiTs: number,
  timeZone: string,
): {at: number; off: number} {
  let lo = loTs;
  let hi = hiTs;
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (offsetSecondsAt(mid, timeZone) === loOff) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return {at: hi, off: offsetSecondsAt(hi, timeZone)};
}

function buildOffsetTable(
  timeZone: string,
  lo: number,
  hi: number,
): OffsetTable {
  const boundary: number[] = [lo];
  let prevOff = offsetSecondsAt(lo, timeZone);
  const offset: number[] = [prevOff];
  let cursor = lo;
  while (cursor < hi) {
    const next = Math.min(cursor + SCAN_STEP_MS, hi);
    if (offsetSecondsAt(next, timeZone) !== prevOff) {
      // One or more transitions lie in (cursor, next]; pin each exactly.
      let segLo = cursor;
      let segLoOff = prevOff;
      for (;;) {
        const t = findTransition(segLo, segLoOff, next, timeZone);
        boundary.push(t.at);
        offset.push(t.off);
        prevOff = t.off;
        segLo = t.at;
        segLoOff = t.off;
        if (offsetSecondsAt(next, timeZone) === t.off) {
          break;
        }
      }
    }
    cursor = next;
  }
  return {boundary, offset};
}

/** Offset for `ts`: the entry of the last boundary <= ts (binary search). */
function offsetFromTable(table: OffsetTable, ts: number): number {
  const {boundary, offset} = table;
  let lo = 0;
  let hi = boundary.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (boundary[mid] <= ts) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return offset[lo];
}

/** Global min/max drink timestamp — bounds each zone's offset table. */
function drinkTimestampRange(
  sessions: UserDrinkingSessionsList,
): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const userId of Object.keys(sessions)) {
    const userSessions = sessions[userId];
    if (!userSessions) {
      continue;
    }
    for (const sessionId of Object.keys(userSessions)) {
      const drinks = userSessions[sessionId]?.drinks;
      if (!drinks) {
        continue;
      }
      for (const tsKey of Object.keys(drinks)) {
        const ts = Number(tsKey);
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
  return Number.isFinite(lo) ? [lo, hi] : [0, 0];
}

/**
 * Single-slot last-call cache. Onyx values come in with stable identity
 * until structurally changed, so identity equality on the object inputs is
 * the "hash" the spec refers to. The hook layer in v2-D additionally wraps
 * this in `useMemo`; the module-level cache is cheap insurance for
 * consecutive identical calls (tests, debug screens, multiple components
 * in a single render).
 */
let lastCall: {
  sessions: unknown;
  drinksToUnits: unknown;
  drinkDefaults: unknown;
  timezone: string;
  weekStart: WeekStart;
  result: DrinkEvent[];
} | null = null;

/**
 * Materialise the per-drink event stream from raw Onyx sessions. One pass:
 * iterate users → sessions → drink timestamps → drink type entries → emit
 * one `DrinkEvent` per (timestamp, drink type).
 *
 * - Excludes `ongoing` sessions and sessions with non-finite `start_time`.
 * - `localDow` is rotated so 0 = `weekStart`; `isWeekend` is the absolute
 *   calendar Sat/Sun.
 * - Both the legacy `number` entry shape and the v2-A
 *   `{count, volume_ml?, abv?}` object shape produce events.
 * - `sdu` is omitted when neither per-entry overrides nor `drinkDefaults`
 *   can supply both `ml` and `abv`.
 * - Pure. Memoised on input identity (sessions / drinksToUnits /
 *   drinkDefaults) plus string equality on `timezone` and `weekStart`.
 */
function buildDrinkEvents(
  sessions: UserDrinkingSessionsList | undefined,
  drinksToUnits: DrinksToUnits | undefined,
  drinkDefaults: DrinkDefaults | undefined,
  timezone: SelectedTimezone,
  weekStart: WeekStart,
): DrinkEvent[] {
  if (
    lastCall &&
    lastCall.sessions === sessions &&
    lastCall.drinksToUnits === drinksToUnits &&
    lastCall.drinkDefaults === drinkDefaults &&
    lastCall.timezone === timezone &&
    lastCall.weekStart === weekStart
  ) {
    return lastCall.result;
  }

  const t0 = performance.now();
  let sessionCount = 0;
  const events: DrinkEvent[] = [];
  if (!sessions) {
    lastCall = {
      sessions,
      drinksToUnits,
      drinkDefaults,
      timezone,
      weekStart,
      result: events,
    };
    return events;
  }

  // Build each session timezone's offset table lazily over the data's span, so
  // every per-drink resolution below is pure arithmetic. Most users have a
  // single zone, so this is a handful of `Intl` probes for the whole pass.
  const [rangeLo, rangeHi] = drinkTimestampRange(sessions);
  const offsetTables = new Map<string, OffsetTable>();
  const resolveParts = (ts: number, tz: string): LocalParts => {
    let table = offsetTables.get(tz);
    if (!table) {
      table = buildOffsetTable(
        tz,
        rangeLo - SCAN_STEP_MS,
        rangeHi + SCAN_STEP_MS,
      );
      offsetTables.set(tz, table);
    }
    return partsFromOffset(ts, offsetFromTable(table, ts));
  };

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
      sessionCount += 1;
      for (const [tsKey, drinksAtTs] of Object.entries(drinks)) {
        const ts = Number(tsKey);
        if (!Number.isFinite(ts)) {
          continue;
        }
        if (!drinksAtTs) {
          continue;
        }
        let parts: LocalParts;
        try {
          parts = resolveParts(ts, sessionTz);
        } catch {
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

  lastCall = {
    sessions,
    drinksToUnits,
    drinkDefaults,
    timezone,
    weekStart,
    result: events,
  };
  logBuildDrinkEvents(performance.now() - t0, sessionCount, events.length);
  return events;
}

export default buildDrinkEvents;
export type {DrinkDefaults};
