import {useEffect, useState} from 'react';
import {InteractionManager, Linking} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {useSplashScreenStateContext} from '@context/global/SplashScreenStateContext';
import Log from '@libs/Log';
import canAutoOpenLiveSessionOnColdStart from '@libs/Navigation/canAutoOpenLiveSessionOnColdStart';
import getColdStartLiveSessionRoute from '@libs/Navigation/getColdStartLiveSessionRoute';
import Navigation from '@libs/Navigation/Navigation';
import {
  hasCompletedOnboarding,
  isLegacyGrandfatheredUser,
} from '@libs/OnboardingSelectors';
import * as PushNotificationActions from '@userActions/PushNotification';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import useCurrentUserData from './useCurrentUserData';

// One decision per JS runtime: a process launch is a cold start, anything
// after it (a sign-out and back in, a remount) is not.
let hasDecided = false;

/**
 * On a cold start with a live session running, open the live session screen
 * instead of Home. Returns whether that decision is settled, so the caller can
 * keep the boot splash up until it is and Home never flashes first.
 *
 * The decision waits for the persisted live-session buffer and the user record
 * to hydrate from local storage (both are warm on a cold start, no network
 * needed), then defers to anything more specific: a deep link, a tapped
 * notification, pending onboarding, or a route the navigator already moved to.
 * Once the splash is gone the launch is over, so a decision that never got its
 * data by then is dropped rather than hijacking a Home the user is already on.
 */
function useLiveSessionColdStart(): boolean {
  const [ongoingSession, ongoingSessionMetadata] = useOnyx(
    ONYXKEYS.ONGOING_SESSION_DATA,
  );
  // `useCurrentUserData` returns {} (truthy) while loading; map empty to
  // undefined so "not loaded yet" reads as such.
  const currentUserData = useCurrentUserData();
  const userData = isEmptyObject(currentUserData) ? undefined : currentUserData;
  const {splashScreenState} = useSplashScreenStateContext();
  const [hasFinished, setHasFinished] = useState(hasDecided);

  const isSplashHidden = splashScreenState === CONST.BOOT_SPLASH_STATE.HIDDEN;
  const isSessionHydrated = ongoingSessionMetadata.status === 'loaded';
  const isResolved =
    !canAutoOpenLiveSessionOnColdStart || hasFinished || isSplashHidden;

  useEffect(() => {
    if (isResolved || hasDecided) {
      return;
    }
    if (!isSessionHydrated || userData === undefined) {
      return;
    }
    hasDecided = true;

    const isOnboardingPending =
      !CONFIG.SKIP_ONBOARDING &&
      !hasCompletedOnboarding(userData) &&
      !isLegacyGrandfatheredUser(userData);

    Promise.all([
      Linking.getInitialURL(),
      PushNotificationActions.getInitialNotificationRoute(),
      Navigation.waitForProtectedRoutes(),
    ])
      .then(([initialUrl, initialNotificationRoute]) => {
        const route = getColdStartLiveSessionRoute({
          ongoingSession,
          initialUrl,
          initialNotificationRoute,
          activeRoute: Navigation.getActiveRoute(),
          isOnboardingPending,
        });
        if (!route) {
          setHasFinished(true);
          return;
        }
        Log.info('[LiveSessionColdStart] Opening the live session');
        Navigation.navigate(route);
        // Settle only once the screen's entry transition has run under the
        // splash: wait a frame so the transition has started, then for it to
        // finish.
        requestAnimationFrame(() => {
          InteractionManager.runAfterInteractions(() => setHasFinished(true));
        });
      })
      .catch(() => setHasFinished(true));
  }, [isResolved, isSessionHydrated, userData, ongoingSession]);

  return isResolved;
}

export default useLiveSessionColdStart;
