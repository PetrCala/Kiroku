import CONST from '@src/CONST';

type FeatureFlag = keyof typeof CONST.FEATURES;

/**
 * Single accessor for static feature flags. Call sites read flags through this
 * function so the backing source (currently `CONST.FEATURES`) can be replaced
 * with an Onyx- or remote-config-backed lookup without touching consumers.
 */
function isEnabled(flag: FeatureFlag): boolean {
  return Boolean(CONST.FEATURES[flag]);
}

export {isEnabled};
export type {FeatureFlag};
