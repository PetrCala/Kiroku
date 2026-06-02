import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionId, DrinksTimestamp} from '@src/types/onyx';
import checkPermission from '@libs/Permissions/checkPermission';
import getCurrentLocation from '@libs/getCurrentLocation';

/**
 * Session-location writes, cut over from direct Firebase RTDB writes to
 * kiroku-api `API.write` calls. Authority is server-side (the caller's Firebase
 * ID token), so callers pass only the sessionId/timestamp; the owner's uid is
 * derived server-side. Optimistic Onyx data mirrors each endpoint's `onyxData`
 * so the inline response is idempotent.
 *
 * The Firebase READ listener that hydrates `sessionLocations_*` is intentionally
 * left in place and coexists with these writes until the read cutover (#809).
 *
 * NOTE: the `sessionLocations_*` Onyx caches are not consumed by any UI yet
 * (capture is the only producer in v1). `purgeAll` deletes the Firebase subtree
 * authoritatively and the server intentionally emits no `onyxData`; stale Onyx
 * entries are inert until the app restarts. When the map / pin view ships, the
 * purge path must also invalidate every matching Onyx key so the UI doesn't
 * render purged pins.
 */

const onyxKeyForSession = (sessionId: DrinkingSessionId) =>
  `${ONYXKEYS.COLLECTION.SESSION_LOCATIONS}${sessionId}` as const;

function getCurrentUserID(): string | undefined {
  return getFirebaseAuth().currentUser?.uid ?? undefined;
}

/**
 * Fire-and-forget: try to capture the device's current GPS fix and attach it
 * to the given (sessionId, timestamp). No-ops silently when the user isn't
 * signed in, when location permission isn't granted (don't re-prompt
 * mid-session), or when the GPS lookup fails or times out. Never throws —
 * capture must never break the drink-add UX.
 *
 * The caller is responsible for gating on the in-app preference
 * (track_location_during_sessions) and on session.ongoing === true.
 */
async function captureForTimestamp(
  sessionId: DrinkingSessionId,
  timestamp: DrinksTimestamp,
): Promise<void> {
  if (!getCurrentUserID()) {
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
    const optimisticData: OnyxUpdate[] = [
      {
        onyxMethod: Onyx.METHOD.MERGE,
        key: onyxKeyForSession(sessionId),
        value: {[timestamp]: location},
      },
    ];
    API.write(
      WRITE_COMMANDS.CAPTURE_SESSION_LOCATION,
      {sessionId, timestamp, location},
      {optimisticData},
    );
  } catch {
    // Silent — location capture is best-effort.
  }
}

/**
 * Delete every location captured for a single session, so locations don't
 * outlive the sessions they describe.
 */
function removeAllForSession(sessionId: DrinkingSessionId) {
  if (!getCurrentUserID()) {
    return;
  }
  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.SET,
      key: onyxKeyForSession(sessionId),
      value: null,
    },
  ];
  API.write(
    WRITE_COMMANDS.CLEAR_SESSION_LOCATIONS,
    {sessionId},
    {optimisticData},
  );
}

/**
 * Privacy action: wipe ALL session locations the user has ever recorded
 * across all sessions. Sessions themselves are untouched. Used by the
 * "Clear location history" settings entry.
 *
 * Firebase is authoritative and the server emits no `onyxData` — see the file
 * header for why we intentionally do not invalidate the Onyx caches here in v1.
 */
function purgeAll() {
  if (!getCurrentUserID()) {
    return;
  }
  API.write(WRITE_COMMANDS.PURGE_SESSION_LOCATIONS, {});
}

export {captureForTimestamp, removeAllForSession, purgeAll};
