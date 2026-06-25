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
  // Positive proof that THIS session's `app/open` succeeded and delivered the
  // user record. Set only by OpenApp's `successData` (reset on cold launch and
  // sign-out), so unlike `isLoadingApp === false` it can't be flipped by a
  // cancelled/early-failed bootstrap.
  const [userDataHydrated] = useOnyx(ONYXKEYS.USER_DATA_HYDRATED);
  // `useCurrentUserData` returns {} (truthy) while loading / after the Onyx
  // record is wiped on account close; the readiness gate and selectors below
  // expect `undefined` to mean "not loaded yet", so map empty → undefined.
  const currentUserData = useCurrentUserData();
  const userData = isEmptyObject(currentUserData) ? undefined : currentUserData;

  const flowState = useMemo<OnboardingFlowState>(() => {
    const skipOnboarding = CONFIG.SKIP_ONBOARDING;
    const isAuthenticated = !!userID;
    // Defer the decision until THIS session's `app/open` has SUCCEEDED
    // (`USER_DATA_HYDRATED === true`) AND the user's record is present.
    //
    // We deliberately gate on `USER_DATA_HYDRATED` rather than
    // `isLoadingApp === false`: the latter is flipped by OpenApp's `finallyData`,
    // which also runs when the request is cancelled or fails fast, so it can
    // read "bootstrap done" while no record was ever delivered. In that window a
    // stale/persisted `USER_DATA_LIST` skeleton (e.g. left behind when a
    // force-quit skipped the sign-out `cleanupSession`) would be read as "needs
    // onboarding", and the one-way OnboardingGuard would strand a returning user
    // in the flow (the returning-Apple-user bug). `USER_DATA_HYDRATED` is set
    // only by OpenApp's `successData`, which lands together with the real record,
    // so it is true only once the authoritative record is in hand.
    const isReady =
      !isAuthenticated || (userDataHydrated === true && userData !== undefined);

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
  }, [userID, userData, config, userDataHydrated]);

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
        userDataHydrated: String(userDataHydrated),
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
    userDataHydrated,
    userData,
    config,
  ]);

  // TEMP diagnostic: log the FULL gate state on every change (not just the
  // shouldFire edge). The 2026-06-25 fix-build repro showed OnboardingGuard
  // redirecting while the edge snapshot above stayed silent and `userData` had
  // been cleared at sign-in — which the gate logic makes impossible. Logging
  // the readiness inputs continuously distinguishes a real logic bug (these
  // values explain the fire) from a stale/mixed JS bundle (these never show
  // userDataHydrated/isReady transitioning the way the redirect implies).
  // Remove once the bug is confirmed fixed on-device.
  const prevStateRef = useRef('');
  useEffect(() => {
    const snapshot = JSON.stringify({
      auth: !!userID,
      userDataHydrated: userDataHydrated ?? null,
      isLoadingApp: isLoadingApp ?? null,
      hasRecord: userData !== undefined,
      isReady: flowState.isReady,
      shouldFire: flowState.shouldFireOnboarding,
    });
    if (snapshot !== prevStateRef.current) {
      prevStateRef.current = snapshot;
      Log.info(`[useOnboardingFlow] state ${snapshot}`);
    }
  }, [
    userID,
    userDataHydrated,
    isLoadingApp,
    userData,
    flowState.isReady,
    flowState.shouldFireOnboarding,
  ]);

  return flowState;
}

export default useOnboardingFlow;
export type {OnboardingFlowState};
