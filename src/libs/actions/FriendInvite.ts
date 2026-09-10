import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {SIDE_EFFECT_REQUEST_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import ONYXKEYS from '@src/ONYXKEYS';
import type {InvitePreview} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * Personal friend invite links (`https://app.kiroku.cz/add/<code>`), backed by
 * kiroku-api `/v1/friends/invite/*`. The signed-in user's own code lives in
 * `userDataList[uid].invite_code` (merged by the fetch/reset responses and by
 * `app/open`).
 *
 * These are live server calls whose outcome the screens wait on, so they use
 * `makeRequestWithSideEffects` rather than the persisted write queue: a reset or
 * redeem replayed minutes later from the queue would be confusing, and the
 * preview has to work before sign-in. The screens gate them on connectivity.
 */

/** `merge userDataList { [uid]: { friends: { [friendID]: value } } }` */
function friendEdge(
  uid: string,
  friendID: UserID,
  value: true | null,
): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.USER_DATA_LIST,
    value: {[uid]: {friends: {[friendID]: value}}},
  };
}

/** Load the caller's invite code, creating it server-side on first use. */
async function fetchInviteCode(): Promise<void> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  await API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.GET_INVITE_CODE,
    {},
  );
}

/** Rotate the caller's invite code. The old link and QR code stop working. */
async function resetInviteCode(): Promise<void> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  await API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.RESET_INVITE_CODE,
    {},
  );
}

/**
 * Who an invite link belongs to. Works signed out. Rejects with an
 * `HttpsError` (404 for any unusable code) the caller maps with
 * `getInviteErrorKind`.
 */
async function getInvitePreview(code: string): Promise<InvitePreview> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  const response = await API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.GET_INVITE_PREVIEW,
    {code},
  );
  if (!response?.invitePreview) {
    throw new Error('Invite preview missing from the response');
  }
  return response.invitePreview;
}

/**
 * Become friends with the owner of `code`. The friendship is applied
 * optimistically so the owner's profile, opened right after, already renders
 * as a friend; it is rolled back if the server refuses. Only call this when the
 * two are not friends yet, or the rollback would drop an existing friendship
 * locally until the next sync. Resolves with the new friend's user ID.
 */
async function redeemInvite(
  code: string,
  ownerUserID: UserID,
): Promise<UserID> {
  const uid = getFirebaseAuth().currentUser?.uid;
  const optimisticData = uid ? [friendEdge(uid, ownerUserID, true)] : [];
  try {
    // eslint-disable-next-line rulesdir/no-api-side-effects-method
    const response = await API.makeRequestWithSideEffects(
      SIDE_EFFECT_REQUEST_COMMANDS.REDEEM_INVITE,
      {code},
      {optimisticData},
    );
    return response?.friendUserID ?? ownerUserID;
  } catch (error) {
    if (uid) {
      Onyx.update([friendEdge(uid, ownerUserID, null)]);
    }
    throw error;
  }
}

/** Remember a link opened while signed out, to reopen it after sign-in. */
function stashPendingInvite(code: string) {
  Onyx.set(ONYXKEYS.PENDING_FRIEND_INVITE, {code, createdAt: Date.now()});
}

function clearPendingInvite() {
  Onyx.set(ONYXKEYS.PENDING_FRIEND_INVITE, null);
}

export {
  clearPendingInvite,
  fetchInviteCode,
  getInvitePreview,
  redeemInvite,
  resetInviteCode,
  stashPendingInvite,
};
