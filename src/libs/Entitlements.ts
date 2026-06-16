import CONST from '@src/CONST';
import * as FeatureFlags from './FeatureFlags';
import type {FeatureFlag} from './FeatureFlags';

/**
 * Pure entitlement resolver for premium-feature gating. Side-effect free (no
 * React, no Onyx, no CONFIG) so the full decision matrix is unit-testable. The
 * `useFeatureAccess` hook supplies the Onyx/CONFIG-derived context.
 */

/** Subscription tier a feature is classified under. */
type Tier = 'free' | 'plus';

/** A registered premium feature, e.g. `'CUSTOM_COLOR_PALETTE'`. */
type PremiumFeatureKey = keyof typeof CONST.PREMIUM_FEATURES;

/** Shape of a single `CONST.PREMIUM_FEATURES` entry. */
type PremiumFeatureConfig = {
  /** The tier this feature requires. */
  tier: Tier;

  /** Optional `CONST.FEATURES` flag; when off, the feature is not in the build. */
  availabilityFlag?: FeatureFlag;
};

/** Forced override applied in non-production builds via the Test Tools panel. */
type DevOverride = 'locked' | 'unlocked';

/** Onyx/CONFIG-derived inputs the hook threads into the resolver. */
type FeatureAccessContext = {
  /** Whether the user holds an active (or grace-period) supporter entitlement. */
  isSupporter: boolean;

  /** Whether supporter status is still hydrating — never lock while true. */
  isSupporterStatusLoading: boolean;

  /** Dev-only forced lock/unlock; callers only pass this in non-prod. */
  devOverride?: DevOverride;

  /** Whether premium gates enforce entitlement in this build. */
  gatesActive: boolean;
};

/** The resolved access decision for a feature. */
type FeatureAccess = {
  /** Whether the feature exists in this build at all (availability flag). */
  isAvailable: boolean;

  /** Whether the feature is currently locked behind the paywall. */
  isLocked: boolean;

  /** Whether this is a paid feature (drives Plus badge / upsell affordances). */
  requiresPlus: boolean;

  /** The feature's configured tier. */
  tier: Tier;

  /** Whether the decision is still pending (supporter status hydrating). */
  isResolving: boolean;
};

function getPremiumFeatureConfig(
  feature: PremiumFeatureKey,
): PremiumFeatureConfig {
  return CONST.PREMIUM_FEATURES[feature];
}

/**
 * Resolve a feature's access from its registry config + the supplied context.
 *
 * Evaluation order (first match wins):
 *  1. Availability flag off  → not in build (unavailable). Beats everything.
 *  2. Dev override present   → honor it (non-prod only; caller enforces that).
 *  3. Free tier              → always unlocked.
 *  4. Plus tier, gates off   → unlocked placeholder (ships free; still "plus").
 *  5. Plus tier, gates on, status loading → unlocked + resolving (no flicker).
 *  6. Plus tier, gates on, loaded → locked iff not a supporter.
 */
function getFeatureAccess(
  feature: PremiumFeatureKey,
  context: FeatureAccessContext,
): FeatureAccess {
  const {isSupporter, isSupporterStatusLoading, devOverride, gatesActive} =
    context;
  const config = getPremiumFeatureConfig(feature);
  const requiresPlus = config.tier === 'plus';

  // 1. Not in this build — overrides every gate, including the dev override.
  if (
    config.availabilityFlag &&
    !FeatureFlags.isEnabled(config.availabilityFlag)
  ) {
    return {
      isAvailable: false,
      isLocked: false,
      requiresPlus: false,
      tier: config.tier,
      isResolving: false,
    };
  }

  // 2. Dev override (non-prod only; the hook strips it in production).
  if (devOverride === 'unlocked' || devOverride === 'locked') {
    return {
      isAvailable: true,
      isLocked: devOverride === 'locked',
      requiresPlus,
      tier: config.tier,
      isResolving: false,
    };
  }

  // 3. Free features are always unlocked.
  if (config.tier === 'free') {
    return {
      isAvailable: true,
      isLocked: false,
      requiresPlus: false,
      tier: 'free',
      isResolving: false,
    };
  }

  // 4. Plus feature, gates inactive → unlocked placeholder (ships free).
  if (!gatesActive) {
    return {
      isAvailable: true,
      isLocked: false,
      requiresPlus: true,
      tier: 'plus',
      isResolving: false,
    };
  }

  // 5. Plus feature, gates active, supporter status still hydrating.
  if (isSupporterStatusLoading) {
    return {
      isAvailable: true,
      isLocked: false,
      requiresPlus: true,
      tier: 'plus',
      isResolving: true,
    };
  }

  // 6. Plus feature, gates active, status loaded.
  return {
    isAvailable: true,
    isLocked: !isSupporter,
    requiresPlus: true,
    tier: 'plus',
    isResolving: false,
  };
}

/** All registered premium-feature keys (stable order for dev tooling). */
function getPremiumFeatureKeys(): PremiumFeatureKey[] {
  return Object.keys(CONST.PREMIUM_FEATURES) as PremiumFeatureKey[];
}

export {getFeatureAccess, getPremiumFeatureKeys};
export type {
  Tier,
  PremiumFeatureKey,
  PremiumFeatureConfig,
  DevOverride,
  FeatureAccessContext,
  FeatureAccess,
};
