import {useEffect} from 'react';
import type {FeatureAccess, PremiumFeatureKey} from '@libs/Entitlements';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import useFeatureAccess from './useFeatureAccess';

/**
 * Route-level guard for a premium feature. Redirects away ONLY once the
 * decision has resolved AND the feature is locked (`!isResolving && isLocked`),
 * so a deep link or stale navigation state can't reach a Plus-only screen, yet
 * the screen never bounces while supporter status is still hydrating.
 *
 * Returns the access object so the screen can render a spinner while
 * `isResolving` and an empty body while `isLocked` (the redirect is in flight),
 * mirroring the defense-in-depth pattern in `SupportKirokuScreen`.
 */
function useFeatureAccessGuard(
  feature: PremiumFeatureKey,
  fallbackRoute: Route = ROUTES.SETTINGS_COLOR_PALETTE,
): FeatureAccess {
  const access = useFeatureAccess(feature);
  const shouldRedirect = !access.isResolving && access.isLocked;

  useEffect(() => {
    if (shouldRedirect) {
      Navigation.goBack(fallbackRoute);
    }
  }, [shouldRedirect, fallbackRoute]);

  return access;
}

export default useFeatureAccessGuard;
