import {useEffect, useRef} from 'react';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import type {Route} from '@src/ROUTES';

const ONBOARDING_ROUTE_PREFIX = 'onboarding/';

function isOnboardingPath(path: string | undefined): path is string {
  return !!path && path.startsWith(ONBOARDING_ROUTE_PREFIX);
}

function pickResumeRoute(
  currentOnboardingRoute: Route,
  lastVisitedPath: string | undefined,
): Route {
  if (isOnboardingPath(lastVisitedPath)) {
    return lastVisitedPath as Route;
  }
  return currentOnboardingRoute;
}

/**
 * Re-routes the user to the active onboarding step whenever the flow should
 * fire. Renders nothing. Mounted as a sibling of the root `RootStack.Navigator`
 * so it can call `Navigation.navigate` once the container is ready and
 * re-evaluate when the target step changes (e.g. Terms → DisplayName).
 *
 * Intentionally does NOT subscribe to navigation state changes: the only
 * supported way to leave the onboarding modal is `navigateAfterOnboarding()`
 * after `completeOnboarding`, and a state listener races that dismissal —
 * the listener fires on the dismissal pop before React has cleaned up the
 * old effect closure, and re-navigates the user back into onboarding.
 *
 * The navigate is queued behind `Navigation.isNavigationReady()`, which can
 * resolve long after the render that scheduled it. The effect cleanup marks
 * the pending continuation stale so a transient `shouldFireOnboarding` render
 * (e.g. a partial record observed mid-hydration) can never navigate an
 * already-onboarded user into the flow after the store has settled — entering
 * onboarding is one-way, so a single stale navigate would strand them there.
 */
function OnboardingGuard() {
  const {
    isReady,
    shouldFireOnboarding,
    currentOnboardingRoute,
    lastVisitedPath,
  } = useOnboardingFlow();
  const lastTargetRef = useRef<Route | null>(null);

  useEffect(() => {
    if (!isReady || !shouldFireOnboarding || !currentOnboardingRoute) {
      lastTargetRef.current = null;
      return;
    }

    let stale = false;
    const target = pickResumeRoute(currentOnboardingRoute, lastVisitedPath);

    Navigation.isNavigationReady().then(() => {
      if (stale) {
        return;
      }
      const active = Navigation.getActiveRoute().replace(/^\//, '');
      if (isOnboardingPath(active)) {
        return;
      }
      if (lastTargetRef.current === target) {
        return;
      }
      lastTargetRef.current = target;
      Log.info(`[OnboardingGuard] Redirecting to ${target}`);
      Navigation.navigate(target);
    });

    return () => {
      stale = true;
    };
  }, [isReady, shouldFireOnboarding, currentOnboardingRoute, lastVisitedPath]);

  return null;
}

OnboardingGuard.displayName = 'OnboardingGuard';

export default OnboardingGuard;
export {ONBOARDING_ROUTE_PREFIX, isOnboardingPath};
