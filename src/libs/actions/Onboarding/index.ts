import Log from '@libs/Log';

/**
 * Stubbed action module for the onboarding rebuild (issues #350–#359).
 *
 * These functions intentionally have no side effects yet — real
 * implementations land in later slices of the epic. They exist now so that
 * later issues can import them without churning callers.
 */

function acceptTerms(): void {
  Log.info('[Onboarding] acceptTerms stub — not yet implemented');
}

function setDisplayName(displayName: string): void {
  Log.info(
    `[Onboarding] setDisplayName stub — not yet implemented (displayName="${displayName}")`,
  );
}

function completeOnboarding(): void {
  Log.info('[Onboarding] completeOnboarding stub — not yet implemented');
}

function navigateAfterOnboarding(): void {
  Log.info('[Onboarding] navigateAfterOnboarding stub — not yet implemented');
}

function setLastVisitedPath(path: string): void {
  Log.info(
    `[Onboarding] setLastVisitedPath stub — not yet implemented (path="${path}")`,
  );
}

export {
  acceptTerms,
  setDisplayName,
  completeOnboarding,
  navigateAfterOnboarding,
  setLastVisitedPath,
};
