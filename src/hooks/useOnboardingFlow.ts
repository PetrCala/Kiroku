import {useMemo} from 'react';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import {
  getOnboardingLastVisitedPath,
  hasAcceptedCurrentTerms,
  hasCompletedOnboarding,
  isLegacyGrandfatheredUser,
} from '@libs/OnboardingSelectors';
import CONFIG from '@src/CONFIG';
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
  const {userData} = useDatabaseData();

  return useMemo<OnboardingFlowState>(() => {
    const skipOnboarding = CONFIG.SKIP_ONBOARDING;
    const isAuthenticated = !!userID;
    // Treat both `undefined` (listener not yet emitted) and `null` (RTDB node
    // missing — either pre-write during signup or post-delete during account
    // closure) as "not enough info, defer." Without this, account deletion
    // briefly flashes the T&C screen: `deleteUserData` wipes the RTDB node
    // before `signOut` runs, the listener emits `null`, and the onboarding
    // selectors interpret that as "needs onboarding" while the user is still
    // authenticated.
    const isReady =
      !isAuthenticated || (userData !== undefined && userData !== null);

    if (skipOnboarding || !isAuthenticated || !isReady) {
      return {
        isReady,
        shouldFireOnboarding: false,
        currentOnboardingRoute: null,
        lastVisitedPath: undefined,
        skipOnboarding,
      };
    }

    if (
      hasCompletedOnboarding(userData) ||
      isLegacyGrandfatheredUser(userData)
    ) {
      return {
        isReady,
        shouldFireOnboarding: false,
        currentOnboardingRoute: null,
        lastVisitedPath: undefined,
        skipOnboarding,
      };
    }

    let currentOnboardingRoute: Route;
    if (!hasAcceptedCurrentTerms(userData)) {
      currentOnboardingRoute = ROUTES.ONBOARDING_TERMS;
    } else if (userData?.profile?.username_chosen === false) {
      currentOnboardingRoute = ROUTES.ONBOARDING_DISPLAY_NAME;
    } else {
      currentOnboardingRoute = ROUTES.ONBOARDING_TERMS;
    }

    return {
      isReady,
      shouldFireOnboarding: true,
      currentOnboardingRoute,
      lastVisitedPath: getOnboardingLastVisitedPath(userData),
      skipOnboarding,
    };
  }, [userID, userData]);
}

export default useOnboardingFlow;
export type {OnboardingFlowState};
