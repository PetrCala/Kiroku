import CONFIG from '@src/CONFIG';

/**
 * Whether Supporter-tier UI should be rendered in this build.
 *
 * Hidden in production until v1.1 launch — Apple's first-subscription gate
 * requires an App Store version submission that attaches `supporter_monthly`
 * before the IAP activates, and that submission will ride with the v1.1 cut.
 * Until then, production builds bundle the supporter code paths (RevenueCat
 * SDK, Onyx selectors, webhook handling, screen registrations) but never
 * render any visual surface. Flip this on for v1.1 by adjusting the gate or
 * by introducing a dedicated env flag — see the helper body.
 *
 * Dev/staging/adhoc builds always show the UI so the feature stays
 * exercisable end-to-end during development.
 */
function isSupporterTierVisible(): boolean {
  return !CONFIG.IS_IN_PRODUCTION;
}

export default {isSupporterTierVisible};
