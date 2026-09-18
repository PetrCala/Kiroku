/**
 * Params for `POST /v1/reports`: file a moderation report against another
 * user, optionally naming one of their session photos.
 */
type ReportUserParams = {
  /** The reported user. */
  otherUserId: string;

  /** Why (`CONST.REPORT.REASON`); the server stores unknown values verbatim. */
  reason: string;

  /** Optional free-text detail. */
  description?: string;

  /**
   * The storage path of the reported session photo, when the report is about
   * that photo rather than the user in general (RFC §9). The server checks it
   * sits in the session-image namespace AND belongs to `otherUserId`.
   */
  objectPath?: string;
};

export default ReportUserParams;
