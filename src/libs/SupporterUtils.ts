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

/**
 * Formats an ISO date string (e.g. a RevenueCat `expirationDate`) into a
 * locale-aware short date. Returns an empty string for missing or unparseable
 * input so callers can treat "no date" and "bad date" identically.
 */
function formatSupporterDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toLocaleDateString();
}

export default {isSupporterTierVisible, formatSupporterDate};
