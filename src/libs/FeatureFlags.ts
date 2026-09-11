import CONST from '@src/CONST';

type FeatureFlag = keyof typeof CONST.FEATURES;

/**
 * Flags flipped for the current page load by the dev-only e2e hooks
 * (`src/libs/E2EHooks`). Always empty outside `__DEV__` builds.
 */
const devOverrides: Partial<Record<FeatureFlag, boolean>> = {};

/**
 * Single accessor for static feature flags. Call sites read flags through this
 * function so the backing source (currently `CONST.FEATURES`) can be replaced
 * with an Onyx- or remote-config-backed lookup without touching consumers.
 */
function isEnabled(flag: FeatureFlag): boolean {
  return devOverrides[flag] ?? Boolean(CONST.FEATURES[flag]);
}

/**
 * Flip a flag in memory until the next page load, so an e2e spec can exercise
 * code that ships switched off. A no-op outside `__DEV__` builds, so a
 * production build always reads `CONST.FEATURES`.
 */
function setDevOverride(flag: FeatureFlag, value: boolean | undefined) {
  if (!__DEV__) {
    return;
  }
  if (value === undefined) {
    delete devOverrides[flag];
    return;
  }
  devOverrides[flag] = value;
}

export {isEnabled, setDevOverride};
export type {FeatureFlag};
