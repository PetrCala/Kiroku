import {useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import {
  hasAcceptedCurrentTerms,
  hasCompletedOnboarding,
} from '@libs/OnboardingSelectors';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';

type OnboardingFlowState = {
  /** Whether enough state is loaded to decide if onboarding should fire. */
  isReady: boolean;

  /** True when the navigator should be mounted for the current user. */
  shouldFireOnboarding: boolean;

  /** The route to land on when onboarding mounts. Null when no step applies. */
  currentOnboardingRoute: Route | null;

  /** Last onboarding path the user visited, used to resume progress. */
  lastVisitedPath: string | undefined;

  /** Honors `CONFIG.SKIP_ONBOARDING` — dev/E2E escape hatch. */
  skipOnboarding: boolean;
};

function useOnboardingFlow(): OnboardingFlowState {
  const {auth} = useFirebase();
  const userID = auth?.currentUser?.uid;

  const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
  const [onboarding] = useOnyx(ONYXKEYS.NVP_ONBOARDING);
  const [acceptedTermsVersion] = useOnyx(ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION);
  const [displayName] = useOnyx(ONYXKEYS.USER_DATA_LIST, {
    selector: list =>
      userID ? list?.[userID]?.profile?.display_name : undefined,
  });
  const [hasUserData] = useOnyx(ONYXKEYS.USER_DATA_LIST, {
    selector: list => (userID ? !!list?.[userID] : false),
  });

  return useMemo<OnboardingFlowState>(() => {
    const skipOnboarding = CONFIG.SKIP_ONBOARDING;
    const isAuthenticated = !!userID;
    const isReady =
      !isAuthenticated || (isLoadingApp === false && hasUserData === true);

    if (skipOnboarding || !isAuthenticated || !isReady) {
      return {
        isReady,
        shouldFireOnboarding: false,
        currentOnboardingRoute: null,
        lastVisitedPath: undefined,
        skipOnboarding,
      };
    }

    const completed = hasCompletedOnboarding(onboarding);
    if (completed) {
      return {
        isReady,
        shouldFireOnboarding: false,
        currentOnboardingRoute: null,
        lastVisitedPath: undefined,
        skipOnboarding,
      };
    }

    const lastVisitedPath =
      onboarding && !Array.isArray(onboarding)
        ? onboarding.last_visited_path
        : undefined;

    let currentOnboardingRoute: Route;
    if (!hasAcceptedCurrentTerms(acceptedTermsVersion)) {
      currentOnboardingRoute = ROUTES.ONBOARDING_TERMS;
    } else if (!displayName) {
      currentOnboardingRoute = ROUTES.ONBOARDING_DISPLAY_NAME;
    } else {
      currentOnboardingRoute = ROUTES.ONBOARDING_TERMS;
    }

    return {
      isReady,
      shouldFireOnboarding: true,
      currentOnboardingRoute,
      lastVisitedPath,
      skipOnboarding,
    };
  }, [
    userID,
    isLoadingApp,
    hasUserData,
    onboarding,
    acceptedTermsVersion,
    displayName,
  ]);
}

export default useOnboardingFlow;
export type {OnboardingFlowState};
