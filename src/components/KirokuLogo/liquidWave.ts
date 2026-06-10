import {LOGO_CANVAS} from './logoShapes';

/** Vertical amplitude of the wave crest (viewBox units) */
const WAVE_AMPLITUDE = 14;
/** Horizontal length of one full wave (viewBox units) */
const WAVE_LENGTH = 256;
/** Horizontal sampling step; ~20 segments across the canvas */
const WAVE_STEP = 55;
/** Overshoot past the canvas edges so the wave never exposes a seam */
const WAVE_OVERSCAN = 60;
/** Bottom edge of the liquid body, safely below the canvas */
const WAVE_BOTTOM_Y = LOGO_CANVAS + 76;

/**
 * Builds the liquid body path: a sine-wave surface at `surfaceY` (phase 0–1
 * shifts it by one full wavelength) closed into a rectangle that extends past
 * the canvas bottom. Runs on the UI thread once per frame while the fill
 * animates, so it sticks to simple string concatenation.
 */
function buildWavePathD(surfaceY: number, phase: number): string {
  'worklet';

  let d = '';
  for (
    let x = -WAVE_OVERSCAN;
    x <= LOGO_CANVAS + WAVE_OVERSCAN;
    x += WAVE_STEP
  ) {
    const y =
      surfaceY +
      WAVE_AMPLITUDE *
        Math.sin((2 * Math.PI * x) / WAVE_LENGTH + 2 * Math.PI * phase);
    d += `${d ? ' L' : 'M'}${x} ${y.toFixed(1)}`;
  }
  d += ` L${LOGO_CANVAS + WAVE_OVERSCAN} ${WAVE_BOTTOM_Y} L${-WAVE_OVERSCAN} ${WAVE_BOTTOM_Y} Z`;
  return d;
}

export default buildWavePathD;
