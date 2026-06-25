import {useEffect, useMemo, useRef} from 'react';
import {useOnyx} from 'react-native-onyx';
import {useConfig} from '@context/global/ConfigContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import Log from '@libs/Log';
import {
  getOnboardingLastVisitedPath,
  hasAcceptedCurrentTerms,
  hasCompletedOnboarding,
  isLegacyGrandfatheredUser,
} from '@libs/OnboardingSelectors';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
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
  const {config} = useConfig();
  const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
  // `useCurrentUserData` returns {} (truthy) while loading / after the Onyx
  // record is wiped on account close; the readiness gate and selectors below
  // expect `undefined` to mean "not loaded yet", so map empty → undefined.
  const currentUserData = useCurrentUserData();
  const userData = isEmptyObject(currentUserData) ? undefined : currentUserData;

  const flowState = useMemo<OnboardingFlowState>(() => {
    const skipOnboarding = CONFIG.SKIP_ONBOARDING;
    const isAuthenticated = !!userID;
    // Defer the decision until the OpenApp bootstrap has fully completed
    // (`IS_LOADING_APP` flips to `false` in its finallyData) AND the user's
    // record is present. `USER_DATA_LIST` is assembled incrementally — the
    // app/open snapshot, Pusher deltas, and optimistic writes each land
    // separately — so "the record is non-empty" does NOT imply "fully loaded".
    // A partial record observed mid-bootstrap would otherwise be read as "needs
    // onboarding" (and the one-way OnboardingGuard would then strand the user).
    // Gating on the explicit bootstrap-complete signal restores the
    // all-or-nothing guarantee the old Firebase listener gave implicitly.
    const isReady =
      !isAuthenticated || (isLoadingApp === false && userData !== undefined);

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
    if (!hasAcceptedCurrentTerms(userData, config)) {
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
  }, [userID, userData, config, isLoadingApp]);

  // TEMP diagnostic (Apple returning-user "onboarding + no friends" race):
  // capture the exact gate inputs the instant onboarding is decided to fire.
  // The reproduced log (2026-06-25) showed OnboardingGuard redirecting to
  // onboarding/terms before OpenApp hydrated the real record, so this snapshot
  // pins which factor opened the gate:
  //   - `isLoadingApp:false` here while OpenApp has not delivered data ==
  //     premature "bootstrap done" (the only `false` writer is OpenApp's
  //     finallyData, which also runs on cancel/early-fail).
  //   - `hasRecord:true` with `hasCompletedOnboarding:false` / `username_chosen`
  //     unset == a stale/partial USER_DATA_LIST record being read (this sign-in
  //     wrote none; the 409 path seeds nothing).
  //   - `configLoaded:false` flipping `hasAcceptedTerms` false can also route to
  //     terms even for an already-onboarded user.
  // Remove once root-caused.
  const prevShouldFireRef = useRef(false);
  useEffect(() => {
    if (flowState.shouldFireOnboarding && !prevShouldFireRef.current) {
      Log.info('[useOnboardingFlow] shouldFireOnboarding -> true', false, {
        isLoadingApp: String(isLoadingApp),
        hasRecord: String(userData !== undefined),
        usernameChosen: String(userData?.profile?.username_chosen),
        hasCompletedOnboarding: String(hasCompletedOnboarding(userData)),
        hasAcceptedTerms: String(hasAcceptedCurrentTerms(userData, config)),
        configLoaded: String(!!config),
        route: String(flowState.currentOnboardingRoute),
      });
    }
    prevShouldFireRef.current = flowState.shouldFireOnboarding;
  }, [
    flowState.shouldFireOnboarding,
    flowState.currentOnboardingRoute,
    isLoadingApp,
    userData,
    config,
  ]);

  return flowState;
}

export default useOnboardingFlow;
export type {OnboardingFlowState};
