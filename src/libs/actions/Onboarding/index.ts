import type {Database} from 'firebase/database';
import {ref, set, update} from 'firebase/database';
import type {User} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import * as Localize from '@libs/Localize';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {setUsername} from '@userActions/User';
import CONST from '@src/CONST';
import DBPATHS from '@src/DBPATHS';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

/**
 * Persist a user's acceptance of the current Terms & Conditions.
 *
 * Writes `agreed_to_terms_at`, `agreed_to_terms_version`, and (when a
 * resume path is supplied) `onboarding.last_visited_path` to Firebase, then
 * mirrors the same values into Onyx so the UI updates without waiting for
 * the server round-trip.
 *
 * @param onboardingPath When acceptance happens inside the onboarding flow,
 *  pass the route to record as the resume point. Omit for standalone
 *  re-consent so onboarding state is not mutated for users who have
 *  already finished onboarding.
 */
async function acceptTerms(
  db: Database,
  user: User | null,
  onboardingPath?: string,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  const userID = user.uid;
  const now = Date.now();
  const version = CONST.CURRENT_TERMS_VERSION;

  const updates: Record<string, number | string> = {};
  updates[DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_AT.getRoute(userID)] = now;
  updates[DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_VERSION.getRoute(userID)] =
    version;
  if (onboardingPath !== undefined) {
    updates[
      DBPATHS.USERS_USER_ID_ONBOARDING_LAST_VISITED_PATH.getRoute(userID)
    ] = onboardingPath;
  }

  await update(ref(db), updates);

  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [userID]: {
      agreed_to_terms_at: now,
      agreed_to_terms_version: version,
      ...(onboardingPath !== undefined && {
        onboarding: {last_visited_path: onboardingPath},
      }),
    },
  });
  await Onyx.merge(ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION, version);
  if (onboardingPath !== undefined) {
    await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {
      last_visited_path: onboardingPath,
    });
  }
}

/**
 * Persist the display name chosen during the onboarding flow.
 *
 * Wraps {@link setUsername} (which atomically writes the new
 * `profile.display_name`, flips `profile.username_chosen`, and updates the
 * nickname index + Firebase auth profile) and additionally records the
 * onboarding resume path so the flow can be picked up where it left off.
 */
async function setDisplayName(
  db: Database,
  user: User | null,
  currentDisplayName: string | undefined,
  newDisplayName: string,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  await setUsername(db, user, currentDisplayName, newDisplayName);

  const userID = user.uid;
  const path = ROUTES.ONBOARDING_DISPLAY_NAME;
  const updates: Record<string, string> = {};
  updates[DBPATHS.USERS_USER_ID_ONBOARDING_LAST_VISITED_PATH.getRoute(userID)] =
    path;

  await update(ref(db), updates);

  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [userID]: {
      onboarding: {last_visited_path: path},
    },
  });
  await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {last_visited_path: path});
}

/**
 * Mark the onboarding flow complete for the given user.
 *
 * Performs the Onyx merge first so the modal navigator unmounts via
 * `useOnboardingFlow` even when the device is offline. The Firebase write is
 * fired without `await` — Firebase RTDB queues offline writes and replays
 * them on reconnect, so blocking the caller would defeat the optimistic
 * guarantee.
 */
async function completeOnboarding(
  db: Database,
  user: User | null,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  const userID = user.uid;
  const now = Date.now();

  await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {completed_at: now});
  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [userID]: {onboarding: {completed_at: now}},
  });

  const completedAtPath =
    DBPATHS.USERS_USER_ID_ONBOARDING_COMPLETED_AT.getRoute(userID);
  set(ref(db, completedAtPath), now).catch(error => {
    Log.warn('[Onboarding] Failed to persist onboarding completion', {error});
  });
}

/**
 * Navigate the user out of the onboarding modal after completion.
 *
 * The modal screen is conditionally rendered in `AuthScreens` based on
 * `shouldFireOnboarding`, so it unmounts automatically once `completed_at`
 * lands in Onyx. We just navigate to Home; resuming the last-attempted
 * protected route is a v2 nice-to-have.
 */
function navigateAfterOnboarding(): void {
  Navigation.navigate(ROUTES.HOME);
}

function setLastVisitedPath(path: string): void {
  Log.info(
    `[Onboarding] setLastVisitedPath stub — not yet implemented (path="${path}")`,
  );
}

export {
  acceptTerms,
  setDisplayName,
  completeOnboarding,
  navigateAfterOnboarding,
  setLastVisitedPath,
};
