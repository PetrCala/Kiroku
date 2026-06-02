import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Friend actions, cut over from direct Firebase RTDB writes
 * (`src/database/friends.ts`) to kiroku-api `API.write` calls. Authority is
 * server-side (the caller's Firebase ID token), so callers pass only the
 * counterpart id; the caller's own uid is used solely for the optimistic Onyx
 * update, which mirrors the server's `onyxData` so the inline response is
 * idempotent. Friend reads still flow through the existing Firebase listeners.
 */

function getCurrentUserID(): string | undefined {
  return getFirebaseAuth().currentUser?.uid ?? undefined;
}

/** Optimistic `merge userDataList { [uid]: patch }`, matching server onyxData. */
function userDataPatch(uid: string, patch: Record<string, unknown>): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.USER_DATA_LIST,
    value: {[uid]: patch},
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
  ];
  API.write(WRITE_COMMANDS.SEND_FRIEND_REQUEST, {toUserId}, {optimisticData});
}

function acceptFriendRequest(fromUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  const optimisticData: OnyxUpdate[] = [
    userDataPatch(uid, {
      friend_requests: {[fromUserId]: null},
      friends: {[fromUserId]: true},
    }),
  ];
  API.write(
    WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST,
    {fromUserId},
    {optimisticData},
  );
}

function deleteFriendRequest(otherUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  const optimisticData: OnyxUpdate[] = [
    userDataPatch(uid, {friend_requests: {[otherUserId]: null}}),
  ];
  API.write(
    WRITE_COMMANDS.DELETE_FRIEND_REQUEST,
    {otherUserId},
    {optimisticData},
  );
}

function unfriend(otherUserId: string) {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  const optimisticData: OnyxUpdate[] = [
    userDataPatch(uid, {friends: {[otherUserId]: null}}),
  ];
  API.write(WRITE_COMMANDS.UNFRIEND, {otherUserId}, {optimisticData});
}

export {sendFriendRequest, acceptFriendRequest, deleteFriendRequest, unfriend};
