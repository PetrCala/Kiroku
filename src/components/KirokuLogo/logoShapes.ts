import CONST from '@src/CONST';
import type Environment from '@libs/Environment/getEnvironment/types';

type Badge = {
  label: string;
  color: string;
};

// Mirror of the badge map in scripts/generate-icons.mjs — keep in sync so the
// in-app logo matches the rasterized icon assets generated for native targets.
const BADGES: Partial<Record<Environment, Badge>> = {
  [CONST.ENVIRONMENT.DEV]: {label: 'DEV', color: '#007AFF'},
  [CONST.ENVIRONMENT.STAGING]: {label: 'STG', color: '#FF9500'},
  [CONST.ENVIRONMENT.ADHOC]: {label: 'ADHOC', color: '#AF52DE'},
};

const LOGO_CANVAS = 1024;

// Badge geometry mirrors scripts/generate-icons.mjs:variantSvg.
const BADGE_TRI = Math.round(LOGO_CANVAS * 0.38);
const BADGE_TX = LOGO_CANVAS - BADGE_TRI;
const BADGE_TY = LOGO_CANVAS - BADGE_TRI;
const BADGE_FONT_SIZE = Math.round(BADGE_TRI * 0.28);
const BADGE_TEXT_X = LOGO_CANVAS - BADGE_TRI * 0.38;
const BADGE_TEXT_Y = LOGO_CANVAS - BADGE_TRI * 0.18;

// The six shapes of the mark, mirroring the master art (see
// scripts/generate-icons.mjs — keep in sync). The master draws the stem and
// baseline as rotated <rect>s; they are pre-converted here to equivalent
// axis-aligned paths so per-shape animation wrappers don't have to handle
// attribute transforms:
//   rect(x=523 y=618 w=185 h=20) rotate(90 523 618)   → x 503–523, y 618–803
//   rect(x=602 y=808 w=180 h=10) rotate(-180 602 808) → x 422–602, y 798–808
// Array order is the assembly stagger order (top-down materialize).
const LOGO_SHAPES: readonly string[] = [
  // Top triangle
  'M636.5 348L512.66 134L389 348H636.5Z',
  // Bottom triangle
  'M388.5 434L512.34 648L636 434L388.5 434Z',
  // Stem (converted rect)
  'M503 618H523V803H503Z',
  // Left leg
  'M129 808L316 480L374 580L243.117 808H129Z',
  // Right leg
  'M895.5 808L708.5 480L650.5 580L781.383 808H895.5Z',
  // Baseline bar (converted rect)
  'M422 798H602V808H422Z',
];

export {
  BADGES,
  LOGO_CANVAS,
  LOGO_SHAPES,
  BADGE_TRI,
  BADGE_TX,
  BADGE_TY,
  BADGE_FONT_SIZE,
  BADGE_TEXT_X,
  BADGE_TEXT_Y,
};
export type {Badge};
