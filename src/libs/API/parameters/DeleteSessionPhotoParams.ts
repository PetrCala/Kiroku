/**
 * Params for `POST /v1/images/session-photo/delete`: remove one session photo's
 * stored object and its record. Owner only; the server looks the record up
 * under the caller's own uid, so a photo that is not theirs is simply not found.
 */
type DeleteSessionPhotoParams = {
  /** The session the photo hangs off. */
  sessionId: string;

  /** The photo's id, i.e. its key in the session's `photos` map. */
  photoId: string;
};

export default DeleteSessionPhotoParams;
