import {SHIMMER_BAND_WIDTH, SHIMMER_SWEEP_FRACTION} from './animationTimings';
import {LOGO_CANVAS} from './logoShapes';

/** Top edge of the sweep band (viewBox units); sits just above the silhouette */
const SHIMMER_BAND_Y = 110;
/** Band height; spans the full silhouette (y 134–808) with margin top and bottom */
const SHIMMER_BAND_HEIGHT = 800;
/** The band parks fully off the left edge and sweeps off the right */
const SHIMMER_TRAVEL_START = -SHIMMER_BAND_WIDTH;
const SHIMMER_TRAVEL_END = LOGO_CANVAS;
/** Loop phase at which the visible sweep begins (dwell occupies everything before) */
const SHIMMER_SWEEP_START_PHASE = 1 - SHIMMER_SWEEP_FRACTION;

/**
 * Horizontal offset of the sweep band for a given loop phase (0–1). The band
 * dwells parked off the left edge for the first (1 - SHIMMER_SWEEP_FRACTION) of
 * the loop, then sweeps across to off the right edge during the final
 * SHIMMER_SWEEP_FRACTION with a smoothstep ease. Putting the sweep at the *end*
 * of the loop means the first shimmer lands a full interval after the entrance
 * settles, rather than immediately on top of the liquid fill. The dwell is baked
 * into this interpolation rather than implemented as a literal delay. Runs on the
 * UI thread once per frame via useAnimatedProps, so it sticks to plain arithmetic
 * (like buildWavePathD).
 */
function getShimmerBandX(phase: number): number {
  'worklet';

  const raw = (phase - SHIMMER_SWEEP_START_PHASE) / SHIMMER_SWEEP_FRACTION;
  const sweep = Math.min(1, Math.max(0, raw));
  // smoothstep: gentle ease-in-out so the band glides rather than starts hard.
  const eased = sweep * sweep * (3 - 2 * sweep);
  return (
    SHIMMER_TRAVEL_START + (SHIMMER_TRAVEL_END - SHIMMER_TRAVEL_START) * eased
  );
}

export default getShimmerBandX;
export {
  SHIMMER_BAND_HEIGHT,
  SHIMMER_BAND_Y,
  SHIMMER_TRAVEL_END,
  SHIMMER_TRAVEL_START,
};
