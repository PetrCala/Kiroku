import {Easing} from 'react-native-reanimated';

// Master timeline for the InitialScreen logo sequence: a single `progress`
// shared value runs 0→1 linearly over TOTAL_DURATION_MS (driven by
// AnimatedKirokuLogoSvg); every animated element derives its own window as a
// 0–1 fraction of that timeline and applies its easing locally. The liquid
// fill increment extends this table without touching the driver.
const TOTAL_DURATION_MS = 700;

/** Delay between consecutive shape entrances */
const SHAPE_STAGGER_MS = 70;
/** Duration of a single shape's entrance */
const SHAPE_DURATION_MS = 280;
/** Opacity each shape reaches at the end of its entrance window */
const SHAPE_TARGET_OPACITY = 1;
/** Downward offset (layout px) each shape starts from */
const SHAPE_TRANSLATE_DISTANCE = 8;

// Composed at module scope so the worklets below capture ready-made easing
// functions instead of rebuilding them per frame.
const SHAPE_OPACITY_EASING = Easing.out(Easing.quad);
const SHAPE_TRANSLATE_EASING = Easing.out(Easing.back(1.5));

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
  SHAPE_TARGET_OPACITY,
  SHAPE_TRANSLATE_DISTANCE,
  SHAPE_OPACITY_EASING,
  SHAPE_TRANSLATE_EASING,
  getShapeWindow,
};
