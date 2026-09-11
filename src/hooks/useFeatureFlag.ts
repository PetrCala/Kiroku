import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import {resolveFeatureFlag} from '@libs/FeatureFlags';
import type {FeatureFlag} from '@libs/FeatureFlags';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Config} from '@src/types/onyx';

const featureFlagOverridesSelector = (config: OnyxEntry<Config>) =>
  config?.feature_flags;

/**
 * `FeatureFlags.isEnabled` for components: re-renders when a remote override
 * changes, so a kill switch takes effect on screen without waiting for an
 * unrelated re-render.
 */
function useFeatureFlag(flag: FeatureFlag): boolean {
  const [overrides] = useOnyx(ONYXKEYS.CONFIG, {
    selector: featureFlagOverridesSelector,
    canBeMissing: true,
  });
  return resolveFeatureFlag(flag, overrides);
}

export default useFeatureFlag;
