/**
 * Params for `GET /v1/images/session-photos`: short-lived signed read URLs for
 * one session's photos. Session images are private objects, so this is the only
 * way to show one.
 */
type GetSessionPhotosParams = {
  /** The session whose photos to read. */
  sessionId: string;

  /** The session's owner. Omit for the signed-in user's own session. */
  userID?: string;
};

export default GetSessionPhotosParams;
