import type {UserID} from '@src/types/onyx/OnyxCommon';

/** Params for the privacy-enforced friend-sessions read (`GET /v1/users/:uid/sessions`). */
type OpenFriendDrinkingSessionsParams = {
  /** The owner whose sessions are being read (never the caller's own uid is assumed; authority is the Bearer token). */
  userID: UserID;
  /** Window floor — only sessions with `start_time >= from` are returned. `0` for the whole collection. */
  from: number;
};

export default OpenFriendDrinkingSessionsParams;
