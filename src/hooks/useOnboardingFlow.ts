import {useEffect, useMemo} from 'react';
import {Alert} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {useConfig} from '@context/global/ConfigContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import * as Environment from '@libs/Environment/Environment';
import Log from '@libs/Log';
import * as OnyxUpdates from '@userActions/OnyxUpdates';
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

  // TODO: temporary diagnostics for the onboarding re-prompt investigation —
  // remove once the firing mechanism is confirmed. Captures the exact decision
  // snapshot whenever the flow decides to fire, so a spurious re-prompt on a
  // device immediately shows WHICH input was poisonous (stale isLoadingApp,
  // partial onboarding node, clobbered username_chosen, missing terms, ...).
  const usernameChosen = userData?.profile?.username_chosen;
  const hasOnboardingNode = userData?.onboarding !== undefined;
  const completedAt = userData?.onboarding?.completed_at;
  const agreedToTermsAt = userData?.agreed_to_terms_at;
  const termsLastUpdated = config?.terms_last_updated;
  useEffect(() => {
    if (!flowState.shouldFireOnboarding) {
      return;
    }
    const snapshot = {
      isLoadingApp,
      route: flowState.currentOnboardingRoute,
      resumePath: flowState.lastVisitedPath,
      usernameChosen,
      hasOnboardingNode,
      completedAt,
      agreedToTermsAt,
      termsLastUpdated,
      // The full record the decision saw, plus which branch each recent server
      // update took in OnyxUpdates.apply — shows whether a response's onyxData
      // was dropped by the lastUpdateID staleness gate.
      record: userData,
      applyTrace: OnyxUpdates.getApplyTrace(),
    };
    Log.info('[useOnboardingFlow] onboarding fired', false, snapshot);
    // On dev builds the Log line lands in the Metro console, but ad-hoc/staging
    // builds strip `console.debug` (babel transform-remove-console) and have no
    // in-app log viewer, so surface the snapshot as an alert there instead.
    // Never on production: a genuine new user must not see a debug popup.
    Environment.isProduction().then(isProd => {
      if (isProd) {
        return;
      }
      Alert.alert('Onboarding diagnostics', JSON.stringify(snapshot, null, 2));
    });
  }, [
    flowState,
    isLoadingApp,
    usernameChosen,
    hasOnboardingNode,
    completedAt,
    agreedToTermsAt,
    termsLastUpdated,
    userData,
  ]);

  return flowState;
}

export default useOnboardingFlow;
export type {OnboardingFlowState};
