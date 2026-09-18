import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import Log from '@libs/Log';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
  DrinkingSessionId,
  SessionPhotoId,
  SignedSessionPhotos,
} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * Session photos (RFC §4.2 and §9). The records live on the session itself, in
 * `cachedDrinkingSessions[uid][sessionId].photos`, written by the server's
 * finalize step, so the calendar and the session detail page read them from the
 * same place as the rest of the session. The bytes are PRIVATE objects, so
 * displaying one needs a short-lived signed url, which is what
 * {@link fetchSessionPhotoUrls} fetches and the caller holds for as long as the
 * gallery is open. A url is deliberately never persisted: it expires, and a
 * stored one would keep working for a viewer who has since lost access.
 *
 * Adding a photo lives in `Image.uploadImage` (the shared presigned pipeline);
 * this module owns removing one and reading them back.
 */

/** Optimistic `merge cachedDrinkingSessions { uid: { sessionId: { photos } } }`. */
function photoPatch(
  uid: UserID,
  sessionId: DrinkingSessionId,
  photoId: SessionPhotoId,
  value: null,
): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.CACHED_DRINKING_SESSIONS,
    value: {[uid]: {[sessionId]: {photos: {[photoId]: value}}}},
  };
}

/**
 * Remove a photo from a session: the stored object and its record both go. The
 * server is the owner-only gate (it looks the record up under the caller's own
 * uid), so this never needs to be told whose photo it is.
 *
 * Queued like any other write, with the photo removed optimistically so the
 * gallery reacts at once and rolls back if the request is dropped.
 */
function deleteSessionPhoto(
  sessionId: DrinkingSessionId,
  photoId: SessionPhotoId,
): void {
  const userID = getFirebaseAuth().currentUser?.uid;
  if (!userID) {
    Log.warn('deleteSessionPhoto: no signed-in user');
    return;
  }
  API.write(
    WRITE_COMMANDS.DELETE_SESSION_PHOTO,
    {sessionId, photoId},
    {optimisticData: [photoPatch(userID, sessionId, photoId, null)]},
  );
}

/**
 * Signed read urls for one session's photos, keyed by photo id.
 *
 * A read rather than a write, so it goes through `makeRequestWithSideEffects`:
 * the urls are short-lived and belong in the calling screen's state, not in
 * Onyx. An empty map is a legitimate answer and means "nothing you may see":
 * the session has no photos, or the viewer is not allowed them. The server
 * answers identically either way, so this never has to distinguish them.
 *
 * `userID` is the session's owner; omit it for the signed-in user's own
 * session.
 */
async function fetchSessionPhotoUrls(
  sessionId: DrinkingSessionId,
  userID?: UserID,
): Promise<SignedSessionPhotos> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  const response = await API.makeRequestWithSideEffects(
    READ_COMMANDS.GET_SESSION_PHOTOS,
    {sessionId, userID},
  );
  return response?.photos ?? {};
}

/**
 * Whether another photo may be added to this session. Mirrors the server's own
 * cap (RFC §9) so the UI hides the add action instead of letting an upload run
 * and fail at finalize.
 */
function canAddPhoto(photoCount: number): boolean {
  return photoCount < CONST.SESSION_PHOTO_LIMIT;
}

export {canAddPhoto, deleteSessionPhoto, fetchSessionPhotoUrls};
