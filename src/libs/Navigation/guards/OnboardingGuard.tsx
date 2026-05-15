import {useEffect, useRef} from 'react';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import navigationRef from '@libs/Navigation/navigationRef';
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
 * Watches onboarding state and re-routes the user to the active onboarding
 * step whenever the flow should fire. Renders nothing. Mounted as a sibling
 * of the root `RootStack.Navigator` so it can call `Navigation.navigate` once
 * the container is ready and continue to re-evaluate on nav state changes.
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
      return undefined;
    }

    const target = pickResumeRoute(currentOnboardingRoute, lastVisitedPath);

    const redirectIfNeeded = () => {
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
    };

    Navigation.isNavigationReady().then(redirectIfNeeded);

    const unsubscribe = navigationRef.current?.addListener('state', () => {
      redirectIfNeeded();
    });

    return () => {
      unsubscribe?.();
    };
  }, [isReady, shouldFireOnboarding, currentOnboardingRoute, lastVisitedPath]);

  return null;
}

OnboardingGuard.displayName = 'OnboardingGuard';

export default OnboardingGuard;
export {ONBOARDING_ROUTE_PREFIX, isOnboardingPath};
