/**
 * The pagination sidecar of a paged sessions read
 * (`GET /v1/users/:uid/sessions?limit=`). The sessions themselves arrive as an
 * Onyx merge; this says whether there is an older page and where it starts.
 */
type SessionsPage = {
  /**
   * `before` for the next page: the oldest `start_time` on this page. `null`
   * when the page reached the start of the history.
   */
  nextCursor: number | null;

  /** How many sessions the page carried after the server's privacy filter. */
  count: number;
};

export default SessionsPage;
