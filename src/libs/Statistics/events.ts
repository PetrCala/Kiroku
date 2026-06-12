import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type DrinkingSession from '@src/types/onyx/DrinkingSession';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {LocalParts} from './localParts';
import {resolveLocalParts} from './localParts';
import {sduFrom} from './sdu';
import {isStoredLocalParts} from './sessionTimeParts';
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
 * Resolve a timestamp's local fields, preferring values stored on the session
 * at write time (zero `Intl`). `stored` is one entry of `session.drinksTimeParts.byTs`,
 * already gated on a matching timezone by the caller; on a missing or corrupt
 * entry we recompute from the raw stamp so a partial map is never wrong. The
 * month is derived from the day string (a free slice — not stored separately).
 */
function localPartsFor(
  ts: number,
  sessionTz: string,
  stored: unknown,
): LocalParts | null {
  if (isStoredLocalParts(stored)) {
    return {
      localDay: stored.d,
      localMonth: stored.d.slice(0, 7),
      localHour: stored.h,
      localIsoWeek: stored.w,
      calendarDow: stored.dow,
    };
  }
  return resolveLocalParts(ts, sessionTz);
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
 * - Excludes only sessions with non-finite `start_time`. In-progress
 *   (`ongoing`) sessions ARE included so a live session counts toward the
 *   monthly stats just as it does on the calendar (the owner's even-fresher
 *   live buffer is overlaid separately in `useHomeStats`).
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
      if (!session) {
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
      // Stored fields are trusted only when they were computed under the
      // session's current timezone; on a mismatch every timestamp falls back to
      // recomputing, so a stale tag can never serve a wrong value.
      const storedByTs =
        session.drinksTimeParts?.tz === sessionTz
          ? session.drinksTimeParts.byTs
          : undefined;
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
          parts = localPartsFor(ts, sessionTz, storedByTs?.[ts]);
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
  return events;
}

export default buildDrinkEvents;
export type {DrinkDefaults};
