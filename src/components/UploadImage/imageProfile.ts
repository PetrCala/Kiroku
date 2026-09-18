import type {ImageUploadKind} from '@libs/API/parameters';
import CONST from '@src/CONST';

/** How a given image kind is cropped, resized and compressed before upload. */
type ImageProfile = {
  /**
   * Target aspect ratio as `[w, h]`, or `null` to keep the source framing. An
   * avatar is a square thumbnail; a session photo is looked at, so cropping it
   * to a fixed ratio would throw away part of what it shows.
   */
  aspectRatio: readonly [number, number] | null;

  /** Width the image is resized to; height follows proportionally. */
  outputWidth: number;

  /** JPEG quality. */
  quality: number;
};

/** The prepare-before-upload profile for an image kind. */
function getImageProfile(kind: ImageUploadKind): ImageProfile {
  const profile = CONST.IMAGE_UPLOAD_PROFILE[kind];
  return {
    aspectRatio: profile.ASPECT_RATIO,
    outputWidth: profile.OUTPUT_WIDTH,
    quality: profile.QUALITY,
  };
}

/**
 * The center-crop rectangle that brings a `srcWidth x srcHeight` image to
 * `aspectRatio`, or the whole image when the profile keeps the source framing.
 *
 * Cropping before the resize is what makes distortion impossible: Android's
 * native crop intent does not reliably honour the aspect constraint, so the
 * picker can hand back arbitrary dimensions.
 */
function getCropRect(
  srcWidth: number,
  srcHeight: number,
  aspectRatio: readonly [number, number] | null,
): {originX: number; originY: number; width: number; height: number} {
  if (!aspectRatio) {
    return {originX: 0, originY: 0, width: srcWidth, height: srcHeight};
  }
  const targetRatio = aspectRatio[0] / aspectRatio[1];
  const srcRatio = srcWidth / srcHeight;

  if (srcRatio > targetRatio) {
    const width = Math.round(srcHeight * targetRatio);
    return {
      originX: Math.round((srcWidth - width) / 2),
      originY: 0,
      width,
      height: srcHeight,
    };
  }
  if (srcRatio < targetRatio) {
    const height = Math.round(srcWidth / targetRatio);
    return {
      originX: 0,
      originY: Math.round((srcHeight - height) / 2),
      width: srcWidth,
      height,
    };
  }
  return {originX: 0, originY: 0, width: srcWidth, height: srcHeight};
}

/**
 * The size the prepared image ends up at: `outputWidth` wide, height scaled
 * from the crop rectangle. Never upscales, so a small source keeps its own size
 * instead of being blown up into a blurrier, larger file. These are the numbers
 * reported to `finalize` as the photo's `w`/`h` (RFC §4.2), so they have to
 * match what is actually produced.
 */
function getOutputSize(
  cropWidth: number,
  cropHeight: number,
  outputWidth: number,
): {width: number; height: number} {
  const width = Math.max(1, Math.min(outputWidth, cropWidth));
  return {
    width,
    height: Math.max(1, Math.round((cropHeight / cropWidth) * width)),
  };
}

export {getCropRect, getImageProfile, getOutputSize};
export type {ImageProfile};
