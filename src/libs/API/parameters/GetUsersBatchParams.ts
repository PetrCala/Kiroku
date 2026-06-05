import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * Params for the batched cross-user read (`GET /v1/users/batch`). Collapses what
 * used to be one request per uid (profile / status) into one request per chunk.
 */
type GetUsersBatchParams = {
  /**
   * The users to read. The server caps each request at 100 uids; callers above
   * that chunk before calling. Authority is the caller's Bearer token.
   */
  userIDs: UserID[];

  /**
   * Optional comma-separated projection selector (e.g. `profile`, `status`,
   * `profile,status`). `profile` is public; `status` is privacy-gated and simply
   * absent for a denied/hidden user.
   */
  fields?: string;
};

export default GetUsersBatchParams;
