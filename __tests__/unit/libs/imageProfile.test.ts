/**
 * @jest-environment node
 */

import {
  getCropRect,
  getImageProfile,
  getOutputSize,
} from '@components/UploadImage/imageProfile';
import CONST from '@src/CONST';

describe('getImageProfile', () => {
  it('crops an avatar square and keeps a session photo as shot', () => {
    expect(getImageProfile(CONST.IMAGE_UPLOAD_KIND.AVATAR).aspectRatio).toEqual(
      [1, 1],
    );
    expect(
      getImageProfile(CONST.IMAGE_UPLOAD_KIND.SESSION).aspectRatio,
    ).toBeNull();
  });

  it('gives a session photo more pixels than an avatar thumbnail', () => {
    expect(
      getImageProfile(CONST.IMAGE_UPLOAD_KIND.SESSION).outputWidth,
    ).toBeGreaterThan(
      getImageProfile(CONST.IMAGE_UPLOAD_KIND.AVATAR).outputWidth,
    );
  });
});

describe('getCropRect', () => {
  it('returns the whole image when the profile keeps the source framing', () => {
    expect(getCropRect(4000, 3000, null)).toEqual({
      originX: 0,
      originY: 0,
      width: 4000,
      height: 3000,
    });
  });

  it('center-crops a landscape image to a square', () => {
    expect(getCropRect(4000, 3000, [1, 1])).toEqual({
      originX: 500,
      originY: 0,
      width: 3000,
      height: 3000,
    });
  });

  it('center-crops a portrait image to a square', () => {
    expect(getCropRect(3000, 4000, [1, 1])).toEqual({
      originX: 0,
      originY: 500,
      width: 3000,
      height: 3000,
    });
  });

  it('leaves an image already at the target ratio alone', () => {
    expect(getCropRect(1000, 1000, [1, 1])).toEqual({
      originX: 0,
      originY: 0,
      width: 1000,
      height: 1000,
    });
  });

  it('crops to a non-square ratio', () => {
    // 3:4 (taller than wide) from a square source takes a 750-wide column out
    // of the middle; 4:3 takes a 750-tall band.
    expect(getCropRect(1000, 1000, [3, 4])).toEqual({
      originX: 125,
      originY: 0,
      width: 750,
      height: 1000,
    });
    expect(getCropRect(1000, 1000, [4, 3])).toEqual({
      originX: 0,
      originY: 125,
      width: 1000,
      height: 750,
    });
  });
});

describe('getOutputSize', () => {
  it('resizes to the output width and scales the height', () => {
    expect(getOutputSize(4000, 3000, 1080)).toEqual({width: 1080, height: 810});
  });

  it('never upscales a source smaller than the output width', () => {
    expect(getOutputSize(800, 600, 1080)).toEqual({width: 800, height: 600});
  });

  it('keeps a square square', () => {
    expect(getOutputSize(3000, 3000, 300)).toEqual({width: 300, height: 300});
  });

  it('never reports a zero dimension for an extreme aspect ratio', () => {
    const {width, height} = getOutputSize(4000, 3, 1080);
    expect(width).toBe(1080);
    expect(height).toBeGreaterThanOrEqual(1);
  });
});
