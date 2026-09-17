import {getSessionEntries} from '@libs/SessionEntries';
import CONST from '@src/CONST';
import type {Config, DrinkingSession, Preferences} from '@src/types/onyx';

/**
 * When the server's stale-session sweep would auto-close an ongoing session
 * (kiroku-api `POST /v1/jobs/close-stale-sessions`, Kiroku#1293).
 *
 * The app does not close anything; it reads the same inputs the sweep does so
 * a surface that outlives a session cannot happen. The Android ongoing
 * notification uses this for `timeoutAfter`.
 */

const HOUR_MS = 60 * 60 * 1000;

/**
 * The effective threshold in hours, or undefined to mean "nothing will be
 * auto-closed". Deliberately identical to kiroku-api's `resolveThresholdHours`,
 * including the part that surprises: with no global default configured the
 * sweep is off for the environment, and no built-in fallback applies.
 */
function resolveAutoCloseHours(
  userPreference: Preferences['auto_close_sessions_after_hours'],
  globalDefault: Config['auto_close_default_hours'],
): number | undefined {
  if (userPreference === CONST.SESSION.AUTO_CLOSE_NEVER) {
    return undefined;
  }
  if (typeof userPreference === 'number' && Number.isFinite(userPreference)) {
    return userPreference;
  }
  if (typeof globalDefault === 'number' && Number.isFinite(globalDefault)) {
    return globalDefault;
  }
  return undefined;
}

/**
 * The moment a session becomes old enough for the sweep to close it, or
 * undefined when nothing will. The sweep measures from the last activity, not
 * the start, so a long night that keeps logging drinks is not cut short; each
 * new drink pushes this out.
 */
function getAutoCloseAt(
  session: DrinkingSession | undefined,
  userPreference: Preferences['auto_close_sessions_after_hours'],
  globalDefault: Config['auto_close_default_hours'],
): number | undefined {
  const hours = resolveAutoCloseHours(userPreference, globalDefault);
  if (hours === undefined || !session?.start_time) {
    return undefined;
  }
  const lastActivity = getSessionEntries(session).reduce(
    (latest, entry) => Math.max(latest, entry.ts),
    session.start_time,
  );
  return lastActivity + hours * HOUR_MS;
}

export {getAutoCloseAt, resolveAutoCloseHours};
