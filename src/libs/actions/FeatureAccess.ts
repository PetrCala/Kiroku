import Onyx from 'react-native-onyx';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PremiumFeatureKey} from '@libs/Entitlements';
import type {FeatureOverride} from '@src/types/onyx/FeatureAccessOverrides';

/**
 * Developer-only writes for the premium-feature gating overrides surfaced in the
 * Test Tools panel. Every write is guarded by `!CONFIG.IS_IN_PRODUCTION` so
 * production can never be influenced even if a caller forgets to gate — this is
 * the inner of the two layers (the hook also strips overrides in production).
 */

function isOverrideWriteAllowed(): boolean {
  return !CONFIG.IS_IN_PRODUCTION;
}

/**
 * Force a single feature locked/unlocked, or clear its override (pass `null`).
 * No-op in production.
 */
function setFeatureOverride(
  feature: PremiumFeatureKey,
  state: FeatureOverride | null,
): void {
  if (!isOverrideWriteAllowed()) {
    return;
  }
  // Onyx.merge drops keys set to `null`, so clearing an override removes the
  // entry rather than persisting a null.
  Onyx.merge(ONYXKEYS.FEATURE_ACCESS_OVERRIDES, {
    features: {[feature]: state},
  });
}

/** Toggle simulated supporter status. No-op in production. */
function setSimulatedSupporter(isSupporter: boolean): void {
  if (!isOverrideWriteAllowed()) {
    return;
  }
  Onyx.merge(ONYXKEYS.FEATURE_ACCESS_OVERRIDES, {
    simulateSupporter: isSupporter,
  });
}

/** Wipe every override back to auto. No-op in production. */
function clearAllFeatureOverrides(): void {
  if (!isOverrideWriteAllowed()) {
    return;
  }
  Onyx.set(ONYXKEYS.FEATURE_ACCESS_OVERRIDES, null);
}

export {setFeatureOverride, setSimulatedSupporter, clearAllFeatureOverrides};
