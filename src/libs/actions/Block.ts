import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as ErrorUtils from '@libs/ErrorUtils';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {TranslationPaths} from '@src/languages/types';
import type {FriendActionMetadata} from '@src/types/onyx/FriendsMetadata';

/**
 * Block actions built on the kiroku-api `API.write` pattern. A one-way block:
 * when the caller blocks `otherUserId`, the server atomically severs the
 * friendship both ways, clears any pending friend requests in either direction,
 * and hides each user from the other; neither can then find or send a request to
 * the other. Authority is server-side (the caller's Firebase ID token), so
 * callers pass only the counterpart id; the caller's own uid is used solely for
 * the optimistic Onyx update.
 *
 * The blocked-user list itself is server-authoritative and hydrates into Onyx via
 * `app/open` + `/v1/updates` (like data-visibility in `Privacy.ts`), so we do NOT
 * guess at its Onyx shape here. The only optimistic change is the local unfriend
 * effect (block implies unfriend): `blockUser` mirrors `unfriend`'s keep-and-dim
 * — it dims the friend row while the write is queued (`FRIENDS_METADATA`), drops
 * the friend (and any pending request) from the signed-in user's `userDataList`
 * record only once the server confirms, and surfaces a dismissible error on
 * failure without losing the row. `unblockUser` does NOT re-friend, and the
 * blocked list is server-hydrated, so it carries no optimistic Onyx data.
 *
 * The helpers below mirror `Friends.ts`, which is the canonical source for this
 * pattern; they are duplicated rather than shared to keep this addition isolated
 * from the friend flow.
 */

const {DELETE} = CONST.RED_BRICK_ROAD_PENDING_ACTION;

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

/**
 * Block a user. The server severs the friendship and clears pending requests
 * both ways and hides each user from the other; the client keeps-and-dims the
 * friend row, then removes the friend and any pending request from the caller's
 * own `userDataList` record once the server confirms.
 */
function blockUser(otherUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  // Keep-and-dim: don't drop the friend until the server confirms the teardown.
  const optimisticData: OnyxUpdate[] = [
    metaPatch(otherUserId, {pendingAction: DELETE, errors: null}),
  ];
  const successData: OnyxUpdate[] = [
    userDataPatch(uid, {
      friends: {[otherUserId]: null},
      friend_requests: {[otherUserId]: null},
    }),
    metaPatch(otherUserId, null),
  ];
  const failureData: OnyxUpdate[] = [
    metaPatch(otherUserId, errorMeta('friendAction.error.couldNotBlockUser')),
  ];
  API.write(
    WRITE_COMMANDS.BLOCK_USER,
    {otherUserId},
    {optimisticData, successData, failureData},
  );
}

/**
 * Unblock a user the caller previously blocked. This does NOT re-establish the
 * friendship. The blocked-user list is server-authoritative and hydrates into
 * Onyx via app updates, so there is no optimistic Onyx data to apply here.
 */
function unblockUser(otherUserId: string) {
  API.write(WRITE_COMMANDS.UNBLOCK_USER, {otherUserId});
}

export {blockUser, unblockUser};
