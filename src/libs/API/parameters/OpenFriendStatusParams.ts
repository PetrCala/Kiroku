import type {UserID} from '@src/types/onyx/OnyxCommon';

/** Params for the privacy-enforced friend-status read (`GET /v1/users/:uid/status`). */
type OpenFriendStatusParams = {
  /** The owner whose presence / latest session is being read. Authority is the Bearer token. */
  userID: UserID;
};

export default OpenFriendStatusParams;
