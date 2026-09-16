import CONST from '@src/CONST';
import {entrySdu, entryUnits, getSessionEntries} from '@libs/SessionEntries';
import type {DrinkDefaults} from '@libs/SessionEntries';
import type DrinkingSession from '@src/types/onyx/DrinkingSession';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {LocalParts} from './localParts';
import {resolveLocalParts} from './localParts';
import {isStoredLocalParts} from './sessionTimeParts';
import type {DrinkEvent, WeekStart} from './types';

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

/** Calendar identity shared by every drink in a session (its `start_time`). */
type AnchorParts = {
  localDay: string;
  localMonth: string;
  localIsoWeek: string;
  localDow: number;
  isWeekend: boolean;
};

/**
 * Derive a session's calendar identity once from its `start_time`. Every drink
 * in the session inherits these day/week/month/dow fields, so a session that
 * crosses midnight (or a month/year boundary) counts on the day it *started* —
 * matching the calendar and the user's "one night out" mental model. The
 * per-drink `localHour` is kept on the real drink time by the caller.
 *
 * `stored` is `session.drinksTimeParts.byTs[startMs]` when the start coincides
 * with a logged drink (zero `Intl`); otherwise the start is resolved fresh via
 * the cached UTC-offset path (one probe per timezone/month). Returns `null`
 * only when the timestamp cannot be resolved at all.
 *
 * NOTE: this single function is the seam a future "day boundary at 6/7am"
 * rule would replace — shift `startMs` before resolving and nothing else needs
 * to change.
 */
function anchorPartsForSession(
  startMs: number,
  sessionTz: string,
  weekStart: WeekStart,
  stored: unknown,
): AnchorParts | null {
  const parts = localPartsFor(startMs, sessionTz, stored);
  if (!parts) {
    return null;
  }
  return {
    localDay: parts.localDay,
    localMonth: parts.localMonth,
    localIsoWeek: parts.localIsoWeek,
    localDow: (parts.calendarDow - weekStart + 7) % 7,
    isWeekend: parts.calendarDow === 0 || parts.calendarDow === 6,
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
 * iterate users → sessions → entries (read through the `SessionEntries`
 * adapter, so legacy buckets and v2 entries look the same) → emit one
 * `DrinkEvent` per entry.
 *
 * - Excludes only sessions with non-finite `start_time`. In-progress
 *   (`ongoing`) sessions ARE included so a live session counts toward the
 *   monthly stats just as it does on the calendar (the owner's even-fresher
 *   live buffer is overlaid separately in `useHomeStats`).
 * - `localDow` is rotated so 0 = `weekStart`; `isWeekend` is the absolute
 *   calendar Sat/Sun.
 * - Legacy buckets (numeric or `{count, volume_ml?, abv?}`) and v2 entries
 *   produce the same events; units and SDU come from `entryUnits` and
 *   `entrySdu`, the one unit computation shared with the session screens.
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
      // An in-progress session is live by definition (it counts as live even if
      // its `type` were somehow unset); otherwise trust the stored `type`.
      const sessionType = session.ongoing
        ? CONST.SESSION.TYPES.LIVE
        : session.type;
      const entries = getSessionEntries(session, userId);
      if (entries.length === 0) {
        continue;
      }
      // Stored fields are trusted only when they were computed under the
      // session's current timezone; on a mismatch every timestamp falls back to
      // recomputing, so a stale tag can never serve a wrong value.
      const storedByTs =
        session.drinksTimeParts?.tz === sessionTz
          ? session.drinksTimeParts.byTs
          : undefined;
      // The whole session is anchored to its start day; every drink below
      // inherits these calendar fields (only `localHour` stays per-drink).
      let anchor: AnchorParts | null;
      try {
        anchor = anchorPartsForSession(
          startMs,
          sessionTz,
          weekStart,
          storedByTs?.[startMs],
        );
      } catch {
        continue;
      }
      if (!anchor) {
        continue;
      }
      for (const entry of entries) {
        const ts = entry.ts;
        let parts: LocalParts | null;
        try {
          parts = localPartsFor(ts, sessionTz, storedByTs?.[ts]);
        } catch {
          continue;
        }
        if (!parts) {
          continue;
        }
        // Only the hour is taken from the drink's own time; day/week/month/dow
        // come from the session anchor.
        const {localHour} = parts;
        events.push({
          userId,
          sessionId,
          ts,
          anchorTs: startMs,
          localDay: anchor.localDay,
          localIsoWeek: anchor.localIsoWeek,
          localMonth: anchor.localMonth,
          localHour,
          localDow: anchor.localDow,
          isWeekend: anchor.isWeekend,
          drinkKey: entry.key,
          count: entry.count,
          units: entryUnits(entry, drinksToUnits),
          sdu: entrySdu(entry, drinkDefaults),
          blackoutSession,
          sessionDurationMin,
          sessionType,
        });
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
