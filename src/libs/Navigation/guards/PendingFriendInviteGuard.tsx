import {useEffect} from 'react';
import {useOnyx} from 'react-native-onyx';
import useOnboardingFlow from '@hooks/useOnboardingFlow';
import {isPendingInviteFresh} from '@libs/FriendInviteUtils';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {clearPendingInvite} from '@userActions/FriendInvite';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import {NAVIGATE_SETTLE_MS, isOnboardingPath} from './OnboardingGuard';

/**
 * How many settle windows to wait for the onboarding modal to finish closing
 * before giving up on this pass. A later Onyx change re-runs the effect.
 */
const MAX_SETTLE_ATTEMPTS = 10;

/**
 * Reopens an invite link (`add/<code>`) that was opened while signed out, once
 * the user has signed in and finished onboarding. The signed-out "Add friend"
 * screen stashes the code in `PENDING_FRIEND_INVITE`; this guard, mounted next
 * to `OnboardingGuard`, waits for the same readiness signal (`isReady` and no
 * onboarding to run) and then navigates. Renders nothing.
 *
 * It navigates only after a settle window, like `OnboardingGuard`, so a
 * decision computed from a half-committed Onyx state is cancelled by the
 * effect cleanup, and it steps aside while an onboarding route is still
 * active. Stale stashes (see `CONST.FRIEND_INVITE.PENDING_TTL_MS`) are dropped.
 */
function PendingFriendInviteGuard() {
  const {isReady, shouldFireOnboarding} = useOnboardingFlow();
  const [pendingInvite] = useOnyx(ONYXKEYS.PENDING_FRIEND_INVITE);

  useEffect(() => {
    if (!pendingInvite) {
      return;
    }
    if (!isPendingInviteFresh(pendingInvite)) {
      clearPendingInvite();
      return;
    }
    if (!isReady || shouldFireOnboarding) {
      return;
    }

    let stale = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const target = ROUTES.ADD_FRIEND.getRoute(pendingInvite.code);

    const attempt = (remaining: number) => {
      settleTimer = setTimeout(() => {
        if (stale) {
          return;
        }
        const active = Navigation.getActiveRoute().replace(/^\//, '');
        if (isOnboardingPath(active)) {
          if (remaining > 1) {
            attempt(remaining - 1);
          }
          return;
        }
        clearPendingInvite();
        if (active === target) {
          return;
        }
        Log.info('[PendingFriendInviteGuard] Reopening invite link');
        Navigation.navigate(target);
      }, NAVIGATE_SETTLE_MS);
    };

    Navigation.isNavigationReady().then(() => {
      if (!stale) {
        attempt(MAX_SETTLE_ATTEMPTS);
      }
    });

    return () => {
      stale = true;
      if (settleTimer !== undefined) {
        clearTimeout(settleTimer);
      }
    };
  }, [pendingInvite, isReady, shouldFireOnboarding]);

  return null;
}

PendingFriendInviteGuard.displayName = 'PendingFriendInviteGuard';

export default PendingFriendInviteGuard;
export {MAX_SETTLE_ATTEMPTS};
