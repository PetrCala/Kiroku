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

/**
 * One `Intl.DateTimeFormat` per timezone. Constructing the formatter is the
 * expensive part of timezone resolution, so we build it once and reuse it for
 * every timestamp in that zone — in practice a single zone per user.
 */
const localPartsFormatters = new Map<string, Intl.DateTimeFormat>();

function getLocalPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = localPartsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    localPartsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * ISO 8601 week label (`RRRR-'W'II`) for a UTC-midnight stamp of a local wall
 * day. The week-numbering year and week can both differ from the calendar year
 * at the Dec/Jan boundary — e.g. 2021-01-01 belongs to 2020-W53.
 */
function isoWeekLabel(localMidnightUtc: number): string {
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
  return `${String(isoYear).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
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
 * Resolve a timestamp's local wall-clock fields with a single cached
 * `formatToParts` call, then derive day-of-week and ISO week arithmetically.
 * Replaces five per-timestamp `formatInTimeZone` calls — the dominant cost of
 * building the event stream. Throws only on an invalid timezone (the caller
 * skips); returns `null` if the formatter omits a field, which no supported
 * runtime does.
 */
function resolveLocalParts(ts: number, timeZone: string): LocalParts | null {
  const fields: Record<string, string> = {};
  for (const part of getLocalPartsFormatter(timeZone).formatToParts(ts)) {
    fields[part.type] = part.value;
  }
  const {year, month, day, hour} = fields;
  if (!year || !month || !day || !hour) {
    return null;
  }
  const localMidnightUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
  );
  return {
    localDay: `${year}-${month}-${day}`,
    localMonth: `${year}-${month}`,
    // `% 24` folds the "24" some ICU builds emit for midnight back to 0.
    localHour: Number(hour) % 24,
    localIsoWeek: isoWeekLabel(localMidnightUtc),
    calendarDow: new Date(localMidnightUtc).getUTCDay(),
  };
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
        let parts: LocalParts | null;
        try {
          parts = resolveLocalParts(ts, sessionTz);
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
