import Onyx from 'react-native-onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {FeatureFlagOverrides} from '@src/types/onyx/Config';

type FeatureFlag = keyof typeof CONST.FEATURES;

// Remote overrides from the global config, kept in module state for the
// non-React `isEnabled`. The config arrives with every app open and reconnect,
// and live over the Pusher `config` channel.
let remoteOverrides: FeatureFlagOverrides | undefined;
Onyx.connectWithoutView({
  key: ONYXKEYS.CONFIG,
  callback: config => {
    remoteOverrides = config?.feature_flags;
  },
});

/**
 * Resolve a flag against a set of remote overrides. A boolean override wins;
 * anything else (absent, `null`, a string) falls back to the compile-time
 * default in `CONST.FEATURES`.
 */
function resolveFeatureFlag(
  flag: FeatureFlag,
  overrides: FeatureFlagOverrides | undefined,
): boolean {
  const override = overrides?.[flag];
  return typeof override === 'boolean'
    ? override
    : Boolean(CONST.FEATURES[flag]);
}

/**
 * Single accessor for feature flags. A server override
 * (`config/feature_flags/<FLAG>`) is checked first, so a flag can be switched
 * off remotely as a kill switch without a release; otherwise the compile-time
 * default in `CONST.FEATURES` applies. See contributingGuides/FEATURE_FLAGS.md.
 *
 * This doesn't re-render anything when an override changes. Components that
 * should react to a kill switch right away use `useFeatureFlag`.
 */
function isEnabled(flag: FeatureFlag): boolean {
  return resolveFeatureFlag(flag, remoteOverrides);
}

export {isEnabled, resolveFeatureFlag};
export type {FeatureFlag};
