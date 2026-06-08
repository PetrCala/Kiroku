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

  /** Target session for `kind: 'session'` uploads (future); unused for avatars. */
  sessionId?: string;
};

export default FinalizeImageParams;
