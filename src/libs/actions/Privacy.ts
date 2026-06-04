import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';

/**
 * Data-visibility actions, cut over from direct Firebase RTDB writes
 * (`src/database/privacy.ts`) to kiroku-api `API.write` calls. Authority is
 * server-side: the owner uid is derived from the caller's Firebase ID token, so
 * callers pass only the target value (and the friend's id for the per-friend
 * toggle). No optimistic Onyx data — the `user_data_visibility` subtree has no
 * top-level Onyx key and is still hydrated by the live Firebase listener in
 * `DatabaseDataContext`, mirroring the server route's empty `onyxData`.
 */

/** Hide (`true`) or reveal (`false`) the caller's drinking data from all friends. */
function setHideFromAllFriends(hidden: boolean) {
  API.write(WRITE_COMMANDS.SET_HIDE_FROM_ALL_FRIENDS, {hidden});
}

/** Hide (`true`) or reveal (`false`) the caller's drinking data from one friend. */
function setFriendDataHidden(friendUid: string, hidden: boolean) {
  API.write(WRITE_COMMANDS.SET_FRIEND_DATA_HIDDEN, {friendUid, hidden});
}

export {setHideFromAllFriends, setFriendDataHidden};
