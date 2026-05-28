import type {UserList} from './OnyxCommon';

/** Owner-controlled visibility of a user's drinking data to their friends.
 *  Absence of this node (or absent fields) means fully visible — the
 *  grandfathered default. */
type DataVisibility = {
  /** When true, no friend can see this user's drinking sessions. */
  hide_from_all?: boolean;

  /** Per-friend blocklist: friends whose UID maps to `true` cannot see this
   *  user's drinking sessions. */
  hidden_from?: UserList;
};

export default DataVisibility;
