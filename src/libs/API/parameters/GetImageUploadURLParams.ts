import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';

/** The kind of image being uploaded through the kiroku-api image pipeline. */
type ImageUploadKind = ValueOf<typeof CONST.IMAGE_UPLOAD_KIND>;

/**
 * Params for `POST /v1/images/upload-url` — mint a presigned bucket PUT URL for
 * a direct-to-storage image upload.
 */
type GetImageUploadURLParams = {
  /** Image kind: `avatar` (public-read) or `session` (private; future). */
  kind: ImageUploadKind;

  /**
   * MIME type of the bytes the client will PUT. The server signs the URL with
   * this content-type, so the PUT must send the exact same value.
   */
  contentType: string;

  /** Target session for `kind: 'session'` uploads (future); unused for avatars. */
  sessionId?: string;
};

export default GetImageUploadURLParams;
export type {ImageUploadKind};
