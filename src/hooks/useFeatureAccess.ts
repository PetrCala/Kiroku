import {useOnyx} from 'react-native-onyx';
import {getFeatureAccess} from '@libs/Entitlements';
import type {FeatureAccess, PremiumFeatureKey} from '@libs/Entitlements';
import SupporterUtils from '@libs/SupporterUtils';
import {getCurrentUserSupporterStatus} from '@libs/UserUtils';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Resolves a premium feature's access for the current user. Supplies the pure
 * `getFeatureAccess` resolver with Onyx/CONFIG-derived context:
 *
 * - `isSupporter` from `USER_PRIVATE_DATA` (or the dev "Simulate Plus" override).
 * - `isSupporterStatusLoading` from the Onyx `{status}` metadata so a Plus
 *   feature never flashes locked while private data hydrates on cold boot.
 * - `devOverride` from `FEATURE_ACCESS_OVERRIDES`, but ONLY outside production
 *   (the action layer also refuses to write it in prod — two layers).
 */
function useFeatureAccess(feature: PremiumFeatureKey): FeatureAccess {
  const [privateData, privateDataMetadata] = useOnyx(
    ONYXKEYS.USER_PRIVATE_DATA,
    {canBeMissing: true},
  );
  const [overrides] = useOnyx(ONYXKEYS.FEATURE_ACCESS_OVERRIDES, {
    canBeMissing: true,
  });

  const overridesActive = !CONFIG.IS_IN_PRODUCTION;
  const simulateSupporter =
    overridesActive && overrides?.simulateSupporter === true;
  const isSupporter =
    getCurrentUserSupporterStatus(privateData).is_supporter ||
    simulateSupporter;
  const devOverride = overridesActive
    ? overrides?.features?.[feature]
    : undefined;

  return getFeatureAccess(feature, {
    isSupporter,
    isSupporterStatusLoading: privateDataMetadata.status === 'loading',
    devOverride,
    gatesActive: SupporterUtils.arePremiumGatesActive(),
  });
}

export default useFeatureAccess;
