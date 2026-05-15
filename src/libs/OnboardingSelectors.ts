import CONST from '@src/CONST';
import type {UserData} from '@src/types/onyx';

/**
 * Returns whether the user has completed the onboarding flow.
 *
 * `completed_at` is the sole source of truth. Brand-new accounts — whose
 * Firebase record has no `onboarding` node yet — return `false` here. The
 * legacy grandfathering policy lives in `isLegacyGrandfatheredUser` so this
 * selector stays small and unambiguous.
 */
function hasCompletedOnboarding(userData: UserData | undefined): boolean {
  if (!userData) {
    return false;
  }
  const onboarding = userData.onboarding as
    | UserData['onboarding']
    | []
    | undefined;
  if (!onboarding) {
    return false;
  }
  if (Array.isArray(onboarding)) {
    return false;
  }
  return onboarding.completed_at !== undefined;
}

/**
 * Returns whether the user's accepted Terms & Conditions version matches the
 * current shipping version.
 */
function hasAcceptedCurrentTerms(userData: UserData | undefined): boolean {
  return userData?.agreed_to_terms_version === CONST.CURRENT_TERMS_VERSION;
}

/**
 * Returns whether this user is a pre-rebuild legacy account that should be
 * grandfathered past the onboarding flow.
 *
 * Discriminator: they accepted T&C under the legacy signup path (so
 * `agreed_to_terms_at` is set) **and** they have a chosen username
 * (`username_chosen !== false`). Users mid-signup whose username step is
 * still pending always go through the new flow, even if `agreed_to_terms_at`
 * happens to be set.
 */
function isLegacyGrandfatheredUser(userData: UserData | undefined): boolean {
  if (!userData) {
    return false;
  }
  if (userData.agreed_to_terms_at === undefined) {
    return false;
  }
  return userData.profile?.username_chosen !== false;
}

/**
 * Returns the last onboarding path the user visited, used to resume their
 * progress when the flow re-fires.
 */
function getOnboardingLastVisitedPath(
  userData: UserData | undefined,
): string | undefined {
  const onboarding = userData?.onboarding as
    | UserData['onboarding']
    | []
    | undefined;
  if (!onboarding || Array.isArray(onboarding)) {
    return undefined;
  }
  return onboarding.last_visited_path;
}

export {
  hasCompletedOnboarding,
  hasAcceptedCurrentTerms,
  isLegacyGrandfatheredUser,
  getOnboardingLastVisitedPath,
};
