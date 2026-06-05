import type {UserID} from '@src/types/onyx/OnyxCommon';

/** Params for the public friend-list read (`GET /v1/users/:uid/friends`). */
type OpenFriendListParams = {
  /** The user whose friends list is being read. Authority is the Bearer token. */
  userID: UserID;
};

export default OpenFriendListParams;
