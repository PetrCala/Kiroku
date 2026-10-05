import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * Params for one page of the session feed
 * (`GET /v1/users/:uid/sessions?limit=&before=`): the `limit` newest sessions
 * started strictly before `before`, newest first. The same privacy-enforced
 * route as `OpenFriendDrinkingSessionsParams`, in its paged shape.
 */
type OpenSessionsPageParams = {
  /** The owner whose sessions are being read (the caller's own uid for the Home feed). */
  userID: UserID;

  /** Page size, at most 100 server-side. */
  limit: number;

  /**
   * Exclusive upper bound on `start_time`: the `nextCursor` of the previous
   * page. Omitted for the first page.
   */
  before?: number;
};

export default OpenSessionsPageParams;
