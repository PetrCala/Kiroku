import type {ImageUploadKind} from './GetImageUploadURLParams';

/**
 * Params for `POST /v1/images/finalize` — server re-validates and moderates the
 * uploaded object, then applies its access policy and persists it (for
 * `kind: 'avatar'`: public-read + a `profile.photo_url` merge in the response's
 * onyxData).
 */
type FinalizeImageParams = {
  /** Image kind, matching the paired `upload-url` request. */
  kind: ImageUploadKind;

  /** Object path returned by `POST /v1/images/upload-url`. */
  objectPath: string;

  /** Target session for `kind: 'session'` uploads; unused for avatars. */
  sessionId?: string;

  /**
   * Pixel width of the uploaded image. Required for `kind: 'session'`: the
   * bytes go straight to the bucket, so the server never sees them, and the
   * gallery lays out against these numbers (RFC §4.2).
   */
  w?: number;

  /** Pixel height. Required for `kind: 'session'`. */
  h?: number;
};

export default FinalizeImageParams;
