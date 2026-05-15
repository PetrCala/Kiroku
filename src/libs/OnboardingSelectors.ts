import CONST from '@src/CONST';
import type {OnyxValue} from '@src/ONYXKEYS';
import type ONYXKEYS from '@src/ONYXKEYS';

/**
 * Returns whether the user has completed the onboarding flow.
 *
 * Treats `undefined` and empty values (`[]`, `{}`) as **completed** so that
 * legacy users created before the onboarding rebuild are not re-trapped in
 * the flow before the server backfill runs.
 */
function hasCompletedOnboarding(
  onboarding: OnyxValue<typeof ONYXKEYS.NVP_ONBOARDING>,
): boolean {
  if (onboarding === undefined || onboarding === null) {
    return true;
  }
  if (Array.isArray(onboarding)) {
    return true;
  }
  if (Object.keys(onboarding).length === 0) {
    return true;
  }
  return onboarding.completed_at !== undefined;
}

/**
 * Returns whether the stored accepted-terms version matches the current
 * Terms & Conditions version.
 */
function hasAcceptedCurrentTerms(
  acceptedVersion: OnyxValue<typeof ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION>,
): boolean {
  return acceptedVersion === CONST.CURRENT_TERMS_VERSION;
}

export {hasCompletedOnboarding, hasAcceptedCurrentTerms};
