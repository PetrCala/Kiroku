import type {Database} from 'firebase/database';
import {ref, update} from 'firebase/database';
import DBPATHS from '@src/DBPATHS';

const hideFromAllRef = DBPATHS.USER_DATA_VISIBILITY_USER_ID_HIDE_FROM_ALL;
const hiddenFromViewerRef =
  DBPATHS.USER_DATA_VISIBILITY_USER_ID_HIDDEN_FROM_VIEWER;

/**
 * Toggle the master switch that hides the user's drinking data from all
 * friends. Writing `null` when disabling keeps the tree clean so absence of
 * the node means "fully visible".
 *
 * @param db Firebase Database object.
 * @param uid ID of the user whose visibility is being changed.
 * @param value Whether to hide drinking data from all friends.
 * @returns An empty promise.
 * @throws In case the database fails to save the data.
 */
async function setHideFromAllFriends(
  db: Database,
  uid: string,
  value: boolean,
): Promise<void> {
  const updates: Record<string, boolean | null> = {};
  updates[hideFromAllRef.getRoute(uid)] = value ? true : null;
  await update(ref(db), updates);
}

/**
 * Add or remove a single friend from the current user's blocklist. A blocked
 * friend can no longer read the user's drinking sessions (enforced by the
 * `user_drinking_sessions` security rule). Writing `null` removes the entry.
 *
 * @param db Firebase Database object.
 * @param ownerUid ID of the user who owns the data being hidden.
 * @param friendUid ID of the friend to hide from / reveal to.
 * @param hidden Whether the friend should be blocked.
 * @returns An empty promise.
 * @throws In case the database fails to save the data.
 */
async function setFriendDataHidden(
  db: Database,
  ownerUid: string,
  friendUid: string,
  hidden: boolean,
): Promise<void> {
  const updates: Record<string, boolean | null> = {};
  updates[hiddenFromViewerRef.getRoute(ownerUid, friendUid)] = hidden
    ? true
    : null;
  await update(ref(db), updates);
}

export {setHideFromAllFriends, setFriendDataHidden};
