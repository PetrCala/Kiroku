import {toPercentageVerbose} from '@libs/DataHandling';
import * as API from '@libs/API';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type {ImageUploadKind} from '@libs/API/parameters';
import type Response from '@src/types/onyx/Response';

/** Extra context for an image upload (e.g. which session a session-image belongs to). */
type UploadImageMeta = {
  /** Target drinking-session id for `kind: 'session'` uploads (future). */
  sessionId?: string;
};

/**
 * Reports upload progress as a verbose percentage string (e.g. `"42.00%"`), or
 * `null` to reset. Matches the `UploadImagePopup` progress contract.
 */
type UploadProgressCallback = (progress: string | null) => void;

const DEFAULT_CONTENT_TYPE = 'image/jpeg';

/**
 * Derive an image MIME type from a local file URI's extension. The avatar flow
 * always hands us a JPEG (expo-image-manipulator output), but deriving keeps the
 * helper correct for the session-image kinds coming next.
 */
function getContentTypeFromUri(uri: string): string {
  const ext = (
    /\.([a-zA-Z0-9]+)(?:[?#].*)?$/.exec(uri)?.[1] ?? ''
  ).toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return DEFAULT_CONTENT_TYPE;
  }
}

/**
 * PUT the blob straight to the bucket's presigned URL via XHR. We use XHR (not
 * `fetch`) for one reason: `xhr.upload.onprogress` is the only cross-platform way
 * to drive the upload progress bar — `fetch` exposes no upload-progress signal.
 *
 * The URL is a GCS V4 presigned write URL: its authorization lives in the query
 * signature, so the PUT MUST send the exact Content-Type the URL was signed with
 * and MUST NOT attach a Bearer token (a second auth mechanism makes GCS reject
 * the request). The authenticated calls in this flow are the upload-url /
 * finalize requests, which go through the kiroku-api layer (Firebase ID token).
 */
function putBlobToBucket(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
  onProgress: UploadProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress(toPercentageVerbose(event.loaded / event.total));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Guarantee the progress bar reaches 100% (the popup keys "finished" off
        // it) even if the last `onprogress` fired short of the total.
        onProgress(toPercentageVerbose(1));
        resolve();
      } else {
        reject(new Error(`Image upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Image upload failed'));
    xhr.send(blob);
  });
}

/**
 * Upload an image through the kiroku-api image pipeline (Kiroku #1059), the
 * generic replacement for the Firebase Storage client SDK:
 *
 *   1. `POST /v1/images/upload-url` → presigned bucket PUT URL + object path.
 *   2. XHR PUT the bytes straight to the bucket (drives the progress bar).
 *   3. `POST /v1/images/finalize` → server validates/moderates the object,
 *      applies its access policy and persists it. For `kind: 'avatar'` the
 *      response's onyxData merges the new public `profile.photo_url`, so the
 *      client never derives or sends the URL itself.
 *
 * This is a foreground, online-only flow: the upload-url / finalize calls go
 * through `makeRequestWithSideEffects` (NOT the offline `API.write` queue) so we
 * can read each response and PUT the bytes between them. A 407 (expired token)
 * is handled by the Reauthentication middleware, which refreshes the token and
 * replays the request, returning the fresh response.
 *
 * @param kind Image kind (`avatar` now; `session` is scaffolded for later).
 * @param uri Local URI of the image to upload.
 * @param onProgress Receives a verbose percentage string as the PUT progresses.
 * @param meta Extra context (e.g. `sessionId` for session images).
 */
async function uploadImage(
  kind: ImageUploadKind,
  uri: string,
  onProgress: UploadProgressCallback,
  meta?: UploadImageMeta,
): Promise<void | Response> {
  if (!uri) {
    throw new Error('No image URI provided');
  }

  const contentType = getContentTypeFromUri(uri);

  // 1. Mint a presigned upload URL (authenticated, via the kiroku-api layer).
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  const uploadUrlResponse = await API.makeRequestWithSideEffects(
    READ_COMMANDS.GET_IMAGE_UPLOAD_URL,
    {kind, contentType, sessionId: meta?.sessionId},
  );
  if (
    !uploadUrlResponse ||
    !uploadUrlResponse.uploadUrl ||
    !uploadUrlResponse.objectPath
  ) {
    throw new Error('Image pipeline did not return an upload URL');
  }
  const {uploadUrl, objectPath} = uploadUrlResponse;

  // 2. Read the local file and PUT the bytes straight to the bucket.
  const blob = await fetch(uri).then(response => response.blob());
  await putBlobToBucket(uploadUrl, blob, contentType, onProgress);

  // 3. Finalize: server applies the access policy + persists. The avatar
  // `photo_url` merge rides back in the response's onyxData (applied by
  // SaveResponseInOnyx), so no client-side optimistic data is supplied here.
  // The two API calls (upload-url + finalize) can't be collapsed into one: the
  // bucket PUT between them must complete before the server can finalize.
  // eslint-disable-next-line rulesdir/no-api-side-effects-method, rulesdir/no-multiple-api-calls
  return API.makeRequestWithSideEffects(WRITE_COMMANDS.FINALIZE_IMAGE, {
    kind,
    objectPath,
    sessionId: meta?.sessionId,
  });
}

export {
  // eslint-disable-next-line import/prefer-default-export
  uploadImage,
};
