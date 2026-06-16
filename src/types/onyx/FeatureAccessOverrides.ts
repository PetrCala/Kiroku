/** Dev-only forced lock/unlock for a single premium feature. */
type FeatureOverride = 'locked' | 'unlocked';

/**
 * Developer-only entitlement overrides set from the Test Tools panel. NEVER
 * read or written in production — `CONFIG.IS_IN_PRODUCTION` gates both the
 * action writes and the hook reads (two layers) — so these only influence
 * dev/staging/adhoc builds.
 */
type FeatureAccessOverrides = {
  /** Per-feature forced state, keyed by a `CONST.PREMIUM_FEATURES` key. */
  features?: Partial<Record<string, FeatureOverride>>;

  /** When true, the current user reads as a Kiroku Plus supporter. */
  simulateSupporter?: boolean;
};

export default FeatureAccessOverrides;
export type {FeatureOverride};
