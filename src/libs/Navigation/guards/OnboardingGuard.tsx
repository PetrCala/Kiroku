import {useEffect, useRef} from 'react';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import type {Route} from '@src/ROUTES';

const ONBOARDING_ROUTE_PREFIX = 'onboarding/';

/**
 * How long a fire decision must stay stable before the guard commits the
 * navigate. The onboarding readiness gate reads two Onyx keys that commit
 * independently inside one `Onyx.update` batch (`Promise.all` over per-key
 * operations — no cross-key ordering): `IS_LOADING_APP` (a tiny merge) can
 * notify subscribers a beat before the `USER_DATA_LIST` record (a large merge)
 * lands. A render in that beat sees "bootstrap done" with a stale record and
 * decides to fire. The commits race on the order of milliseconds; one settle
 * window absorbs them, and the effect cleanup cancels the pending navigate
 * when the late-landing record flips the decision back. A genuine new user
 * just sees the onboarding screen this much later.
 */
const NAVIGATE_SETTLE_MS = 500;

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
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const target = pickResumeRoute(currentOnboardingRoute, lastVisitedPath);

    Navigation.isNavigationReady().then(() => {
      if (stale) {
        return;
      }
      // Don't navigate on the first render that decided to fire: hold the
      // decision through one settle window so a fire computed from a
      // mid-commit Onyx state (see NAVIGATE_SETTLE_MS) is cancelled by the
      // cleanup instead of stranding the user in the one-way flow.
      settleTimer = setTimeout(() => {
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
      }, NAVIGATE_SETTLE_MS);
    });

    return () => {
      stale = true;
      if (settleTimer !== undefined) {
        clearTimeout(settleTimer);
      }
    };
  }, [isReady, shouldFireOnboarding, currentOnboardingRoute, lastVisitedPath]);

  return null;
}

OnboardingGuard.displayName = 'OnboardingGuard';

export default OnboardingGuard;
export {ONBOARDING_ROUTE_PREFIX, isOnboardingPath, NAVIGATE_SETTLE_MS};
