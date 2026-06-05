/**
 * Body for `POST /v1/onboarding/accept-terms`. The server decides the accepted
 * terms version, so the client never sends one — only the optional onboarding
 * resume path (present when acceptance happens inside the onboarding flow).
 */
type AcceptTermsParams = {
  onboardingPath?: string;
};

export default AcceptTermsParams;
