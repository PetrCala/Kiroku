import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as ErrorUtils from '@libs/ErrorUtils';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {TranslationPaths} from '@src/languages/types';
import type {PendingAction} from '@src/types/onyx/OnyxCommon';
import type {FriendActionMetadata} from '@src/types/onyx/FriendsMetadata';

/**
 * Friend actions, cut over from direct Firebase RTDB writes to kiroku-api
 * `API.write` calls. Authority is server-side (the caller's Firebase ID token),
 * so callers pass only the counterpart id; the caller's own uid is used solely
 * for the optimistic Onyx update. Friend reads are sourced from Onyx
 * `userDataList` (the signed-in user's `friends`/`friend_requests`), hydrated by
 * `app/open` and kept in sync via Pusher + `/v1/updates` — not Firebase
 * listeners.
 *
 * Offline feedback (pattern B): each action marks a `pendingAction` in
 * `FRIENDS_METADATA` (keyed by the counterpart uid) so the row can dim while the
 * write is queued, clears it in `successData`, and surfaces a dismissible error
 * in `failureData`. Additive actions (send) apply their data change optimistically
 * and keep the row on failure; destructive actions (accept/reject/unfriend) defer
 * the data mutation to `successData` so the row stays visible and dimmed until the
 * server confirms (keep-and-dim).
 */

const {ADD, UPDATE, DELETE} = CONST.RED_BRICK_ROAD_PENDING_ACTION;

function getCurrentUserID(): string | undefined {
  return getFirebaseAuth().currentUser?.uid ?? undefined;
}

/** Optimistic `merge userDataList { [uid]: patch }`. */
function userDataPatch(
  uid: string,
  patch: Record<string, unknown>,
): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.USER_DATA_LIST,
    value: {[uid]: patch},
  };
}

/** `merge friendsMetadata { [otherUserId]: meta }` (null removes the entry). */
function metaPatch(
  otherUserId: string,
  meta: FriendActionMetadata | null,
): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.FRIENDS_METADATA,
    value: {[otherUserId]: meta},
  };
}

function errorMeta(message: TranslationPaths): FriendActionMetadata {
  return {
    errors: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey(message),
  };
}

function sendFriendRequest(toUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  const optimisticData: OnyxUpdate[] = [
    userDataPatch(uid, {
      friend_requests: {[toUserId]: CONST.FRIEND_REQUEST_STATUS.SENT},
    }),
    metaPatch(toUserId, {pendingAction: ADD, errors: null}),
  ];
  const successData: OnyxUpdate[] = [metaPatch(toUserId, null)];
  // Keep the optimistic request row on failure and mark it errored; dismissing
  // it (clearFriendActionError) removes the row because pendingAction is ADD.
  const failureData: OnyxUpdate[] = [
    metaPatch(toUserId, errorMeta('friendAction.error.couldNotSendRequest')),
  ];
  API.write(
    WRITE_COMMANDS.SEND_FRIEND_REQUEST,
    {toUserId},
    {optimisticData, successData, failureData},
  );
}

function acceptFriendRequest(fromUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  // Keep-and-dim: don't move the request to `friends` until the server confirms.
  const optimisticData: OnyxUpdate[] = [
    metaPatch(fromUserId, {pendingAction: UPDATE, errors: null}),
  ];
  const successData: OnyxUpdate[] = [
    userDataPatch(uid, {
      friend_requests: {[fromUserId]: null},
      friends: {[fromUserId]: true},
    }),
    metaPatch(fromUserId, null),
  ];
  const failureData: OnyxUpdate[] = [
    metaPatch(
      fromUserId,
      errorMeta('friendAction.error.couldNotAcceptRequest'),
    ),
  ];
  API.write(
    WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST,
    {fromUserId},
    {optimisticData, successData, failureData},
  );
}

function deleteFriendRequest(otherUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  // Keep-and-dim: don't drop the request until the server confirms.
  const optimisticData: OnyxUpdate[] = [
    metaPatch(otherUserId, {pendingAction: DELETE, errors: null}),
  ];
  const successData: OnyxUpdate[] = [
    userDataPatch(uid, {friend_requests: {[otherUserId]: null}}),
    metaPatch(otherUserId, null),
  ];
  const failureData: OnyxUpdate[] = [
    metaPatch(
      otherUserId,
      errorMeta('friendAction.error.couldNotRemoveRequest'),
    ),
  ];
  API.write(
    WRITE_COMMANDS.DELETE_FRIEND_REQUEST,
    {otherUserId},
    {optimisticData, successData, failureData},
  );
}

function unfriend(otherUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  // Keep-and-dim: don't drop the friend until the server confirms.
  const optimisticData: OnyxUpdate[] = [
    metaPatch(otherUserId, {pendingAction: DELETE, errors: null}),
  ];
  const successData: OnyxUpdate[] = [
    userDataPatch(uid, {friends: {[otherUserId]: null}}),
    metaPatch(otherUserId, null),
  ];
  const failureData: OnyxUpdate[] = [
    metaPatch(otherUserId, errorMeta('friendAction.error.couldNotUnfriend')),
  ];
  API.write(
    WRITE_COMMANDS.UNFRIEND,
    {otherUserId},
    {optimisticData, successData, failureData},
  );
}

/**
 * Dismiss the offline-feedback error for a friend action. For a failed ADD
 * (send request) this also rolls back the optimistic request entry, since the
 * request never reached the server; for UPDATE/DELETE the data was never mutated
 * optimistically, so clearing the metadata returns the row to its normal state.
 */
function clearFriendActionError(
  otherUserId: string,
  pendingAction: PendingAction,
) {
  if (pendingAction === ADD) {
    const uid = getCurrentUserID();
    if (uid) {
      Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
        [uid]: {friend_requests: {[otherUserId]: null}},
      });
    }
  }
  Onyx.merge(ONYXKEYS.FRIENDS_METADATA, {[otherUserId]: null});
}

export {
  sendFriendRequest,
  acceptFriendRequest,
  deleteFriendRequest,
  unfriend,
  clearFriendActionError,
};
