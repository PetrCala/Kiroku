/**
 * Body for `POST /v1/onboarding/last-visited-path`. Records the onboarding
 * resume point so a user who drops out mid-flow returns where they left off.
 */
type SetOnboardingLastVisitedPathParams = {
  path: string;
};

export default SetOnboardingLastVisitedPathParams;
