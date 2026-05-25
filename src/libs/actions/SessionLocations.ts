import Onyx from 'react-native-onyx';
import type {Database} from 'firebase/database';
import {ref, remove, update} from 'firebase/database';
import type {User} from 'firebase/auth';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionId, DrinksTimestamp} from '@src/types/onyx';
import checkPermission from '@libs/Permissions/checkPermission';
import getCurrentLocation from '@libs/getCurrentLocation';

// NOTE: Onyx caches for `sessionLocations_*` are not consumed by any UI yet
// (capture is the only producer in v1). On purge we delete the Firebase
// subtree authoritatively; stale Onyx entries are inert until the app
// restarts. When the map / pin view ships, this file must also invalidate
// every matching Onyx key so the UI doesn't render purged pins.

const onyxKeyForSession = (sessionId: DrinkingSessionId) =>
  `${ONYXKEYS.COLLECTION.SESSION_LOCATIONS}${sessionId}` as const;

const firebasePathForSession = (uid: string, sessionId: DrinkingSessionId) =>
  `user_session_locations/${uid}/${sessionId}` as const;

const firebasePathForTimestamp = (
  uid: string,
  sessionId: DrinkingSessionId,
  timestamp: DrinksTimestamp,
) => `user_session_locations/${uid}/${sessionId}/${timestamp}` as const;

const firebasePathForUser = (uid: string) =>
  `user_session_locations/${uid}` as const;

/**
 * Fire-and-forget: try to capture the device's current GPS fix and attach it
 * to the given (sessionId, timestamp). No-ops silently when location permission
 * isn't granted (don't re-prompt mid-session) or when the GPS lookup fails
 * or times out. Never throws — capture must never break the drink-add UX.
 *
 * The caller is responsible for gating on the in-app preference
 * (track_location_during_sessions) and on session.ongoing === true.
 */
async function captureForTimestamp(
  db: Database,
  user: User | null,
  sessionId: DrinkingSessionId,
  timestamp: DrinksTimestamp,
): Promise<void> {
  if (!user) {
    return;
  }
  try {
    const allowed = await checkPermission('location');
    if (!allowed) {
      return;
    }
    const location = await getCurrentLocation();
    if (!location) {
      return;
    }
    await Onyx.merge(onyxKeyForSession(sessionId), {[timestamp]: location});
    await update(ref(db), {
      [firebasePathForTimestamp(user.uid, sessionId, timestamp)]: location,
    });
  } catch {
    // Silent — location capture is best-effort.
  }
}

/**
 * Delete every location captured for a single session. Called from the
 * session-delete path so locations don't outlive the sessions they describe.
 */
async function removeAllForSession(
  db: Database,
  user: User | null,
  sessionId: DrinkingSessionId,
): Promise<void> {
  if (!user) {
    return;
  }
  await Onyx.set(onyxKeyForSession(sessionId), null);
  await remove(ref(db, firebasePathForSession(user.uid, sessionId)));
}

/**
 * Privacy action: wipe ALL session locations the user has ever recorded
 * across all sessions. Sessions themselves are untouched. Used by the
 * "Clear location history" settings entry.
 *
 * Firebase is authoritative — see the file header for why we intentionally
 * do not invalidate the Onyx caches here in v1.
 */
async function purgeAll(db: Database, user: User | null): Promise<void> {
  if (!user) {
    return;
  }
  await remove(ref(db, firebasePathForUser(user.uid)));
}

export {captureForTimestamp, removeAllForSession, purgeAll};
