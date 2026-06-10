import {Easing} from 'react-native-reanimated';

// Master timeline for the InitialScreen logo sequence: a single `progress`
// shared value runs 0→1 linearly over TOTAL_DURATION_MS (driven by
// AnimatedKirokuLogoSvg); every animated element derives its own window as a
// 0–1 fraction of that timeline and applies its easing locally.
//
// | element            | window (ms) | property                  |
// |--------------------|-------------|---------------------------|
// | shape i (0–5)      | 70i–70i+280 | opacity 0→GHOST, settle Y |
// | liquid level       | 800–2200    | surface 830→110 (viewBox) |
// | crossfade          | 2200–2600   | shapes GHOST→1, liquid →0 |
const TOTAL_DURATION_MS = 2600;

/** Delay between consecutive shape entrances */
const SHAPE_STAGGER_MS = 70;
/** Duration of a single shape's entrance */
const SHAPE_DURATION_MS = 280;
/** Faint "ghost" opacity the shapes hold while the liquid fills them */
const GHOST_OPACITY = 0.13;
/** Downward offset (layout px) each shape starts from */
const SHAPE_TRANSLATE_DISTANCE = 8;

/** Window in which the liquid surface rises through the mark */
const LIQUID_START_FRACTION = 800 / TOTAL_DURATION_MS;
const LIQUID_END_FRACTION = 2200 / TOTAL_DURATION_MS;
/**
 * Liquid surface levels in viewBox coordinates. The silhouette spans
 * y 134–808; starting below 808 + wave amplitude keeps the liquid fully
 * clipped out before the window, and ending above 134 - amplitude reads as
 * 100% full.
 */
const LIQUID_SURFACE_START_Y = 830;
const LIQUID_SURFACE_END_Y = 110;

/** Window in which the ghost shapes solidify and the liquid fades away */
const CROSSFADE_START_FRACTION = 2200 / TOTAL_DURATION_MS;

/** Period of one full wave oscillation (drives the independent phase value) */
const WAVE_PERIOD_MS = 1600;

// Composed at module scope so the worklets below capture ready-made easing
// functions instead of rebuilding them per frame.
const SHAPE_OPACITY_EASING = Easing.out(Easing.quad);
const SHAPE_TRANSLATE_EASING = Easing.out(Easing.back(1.5));
const LIQUID_LEVEL_EASING = Easing.inOut(Easing.cubic);
const CROSSFADE_EASING = Easing.inOut(Easing.ease);

/**
 * Window of the master timeline (as 0–1 fractions) in which the shape at
 * `index` plays its entrance.
 */
function getShapeWindow(index: number): [start: number, end: number] {
  const startMs = SHAPE_STAGGER_MS * index;
  return [
    startMs / TOTAL_DURATION_MS,
    (startMs + SHAPE_DURATION_MS) / TOTAL_DURATION_MS,
  ];
}

export {
  TOTAL_DURATION_MS,
  GHOST_OPACITY,
  SHAPE_TRANSLATE_DISTANCE,
  LIQUID_START_FRACTION,
  LIQUID_END_FRACTION,
  LIQUID_SURFACE_START_Y,
  LIQUID_SURFACE_END_Y,
  CROSSFADE_START_FRACTION,
  WAVE_PERIOD_MS,
  SHAPE_OPACITY_EASING,
  SHAPE_TRANSLATE_EASING,
  LIQUID_LEVEL_EASING,
  CROSSFADE_EASING,
  getShapeWindow,
};
