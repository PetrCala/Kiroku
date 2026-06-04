import type {DrinksList} from '@src/types/onyx/Drinks';
import type {
  SessionTimeParts,
  StoredLocalParts,
  UserDrinkingSessionsList,
} from '@src/types/onyx/DrinkingSession';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {resolveLocalParts} from './localParts';
import type {DrinkEvent, WeekStart} from './types';

/**
 * Runtime guard for a stored entry. Onyx persistence has produced corrupt
 * values in the wild (e.g. `NaN` keys), so the read path validates a stored
 * entry's shape before trusting it and falls back to recomputing on failure.
 */
function isStoredLocalParts(value: unknown): value is StoredLocalParts {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.d === 'string' &&
    typeof candidate.h === 'number' &&
    typeof candidate.w === 'string' &&
    typeof candidate.dow === 'number'
  );
}

/**
 * Write path: compute the precomputed local fields for every drink timestamp in
 * a session, in timezone `tz`. One `Intl` call per timestamp — paid while the
 * user is saving, never on the Statistics cold path.
 *
 * Returns `undefined` when there is nothing worth storing (no drinks, or no
 * timestamp resolved), so callers can skip writing an empty map.
 */
function buildSessionTimeParts(
  drinks: DrinksList | undefined,
  tz: string,
): SessionTimeParts | undefined {
  if (!drinks) {
    return undefined;
  }
  const byTs: Record<number, StoredLocalParts> = {};
  let stored = false;
  for (const tsKey of Object.keys(drinks)) {
    const ts = Number(tsKey);
    if (!Number.isFinite(ts)) {
      continue;
    }
    let parts;
    try {
      parts = resolveLocalParts(ts, tz);
    } catch {
      continue;
    }
    if (!parts) {
      continue;
    }
    byTs[ts] = {
      d: parts.localDay,
      h: parts.localHour,
      w: parts.localIsoWeek,
      dow: parts.calendarDow,
    };
    stored = true;
  }
  return stored ? {tz, byTs} : undefined;
}

/** A deep-partial merge patch for `CACHED_DRINKING_SESSIONS`. */
type TimePartsPatch = Record<
  UserID,
  Record<string, {drinksTimeParts: SessionTimeParts}>
>;

/**
 * Backfill path: reconstruct the stored fields from an already-materialised
 * `DrinkEvent[]` — **zero** `Intl` work, since every field bar the absolute
 * day-of-week is carried verbatim on the event, and `calendarDow` inverts the
 * weekStart rotation (`localDow = (calendarDow - weekStart + 7) % 7`).
 *
 * Only sessions whose stored parts are absent or computed under a different
 * timezone are included, so a steady state produces an empty patch and the
 * caller's merge converges (no rewrite loop). The `tz` tag is derived exactly
 * as the read path derives it, so a backfilled session is immediately trusted.
 *
 * Returns `null` when nothing needs backfilling.
 */
function buildTimePartsPatchFromEvents(
  events: DrinkEvent[],
  sessions: UserDrinkingSessionsList | undefined,
  defaultTimezone: string,
  weekStart: WeekStart,
): TimePartsPatch | null {
  if (events.length === 0 || !sessions) {
    return null;
  }
  const patch: TimePartsPatch = {};
  for (const event of events) {
    const session = sessions[event.userId]?.[event.sessionId];
    if (!session) {
      continue;
    }
    const sessionTz = session.timezone ?? defaultTimezone;
    if (session.drinksTimeParts?.tz === sessionTz) {
      continue;
    }
    let userPatch = patch[event.userId];
    if (!userPatch) {
      userPatch = {};
      patch[event.userId] = userPatch;
    }
    let sessionPatch = userPatch[event.sessionId];
    if (!sessionPatch) {
      sessionPatch = {drinksTimeParts: {tz: sessionTz, byTs: {}}};
      userPatch[event.sessionId] = sessionPatch;
    }
    sessionPatch.drinksTimeParts.byTs[event.ts] = {
      d: event.localDay,
      h: event.localHour,
      w: event.localIsoWeek,
      dow: (event.localDow + weekStart) % 7,
    };
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export {
  buildSessionTimeParts,
  buildTimePartsPatchFromEvents,
  isStoredLocalParts,
};
export type {TimePartsPatch};
