import type {UserArray, UserID, UserList} from '@src/types/onyx/OnyxCommon';

/**
 * Block-filtering helpers for the one-way block feature.
 *
 * The client only ever holds the signed-in user's OWN OUTBOUND block list
 * (`USER_DATA_LIST[myUid].blocked` = the uids *I* have blocked). A user can NOT
 * see who has blocked *them* — that list is owner-private server-side. So these
 * helpers answer only "did I block this user?". The inbound case (they blocked
 * me) needs no client filtering: the server gate already makes their data
 * unreadable (the read is denied / the cached entry is evicted), and the UI's
 * job there is just to degrade gracefully into an empty state.
 *
 * The server is the source of truth (it severs the friendship both ways and
 * denies block-gated reads). These helpers are the defense-in-depth UX layer so
 * the client never surfaces, counts, or offers actions on a user the signed-in
 * user has blocked, even for cached or edge-case data the server has not yet
 * evicted. Mirrors the friend-list helpers in [[FriendUtils]].
 */

/**
 * Whether `uid` is in the signed-in user's outbound block list.
 *
 * @param blockedList - the signed-in user's `blocked` map, i.e.
 *   `USER_DATA_LIST[myUid].blocked`. Undefined when the user has blocked nobody.
 * @param uid - the user to test.
 */
function isBlocked(blockedList: UserList | undefined, uid: UserID): boolean {
  return !!blockedList?.[uid];
}

/**
 * Remove every uid the signed-in user has blocked from `userIds`, preserving
 * order. Returns the input array unchanged when there is no block list, so the
 * common "nobody blocked" path allocates nothing.
 *
 * @param userIds - the candidate user ids (e.g. search results, a friend list).
 * @param blockedList - the signed-in user's `blocked` map.
 */
function filterBlockedUsers(
  userIds: UserArray,
  blockedList: UserList | undefined,
): UserArray {
  if (!blockedList) {
    return userIds;
  }
  return userIds.filter(uid => !isBlocked(blockedList, uid));
}

export {isBlocked, filterBlockedUsers};
