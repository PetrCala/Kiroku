import type {Database} from 'firebase/database';
import {ref, update} from 'firebase/database';
import type {User} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import * as Localize from '@libs/Localize';
import Log from '@libs/Log';
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

function completeOnboarding(): void {
  Log.info('[Onboarding] completeOnboarding stub — not yet implemented');
}

function navigateAfterOnboarding(): void {
  Log.info('[Onboarding] navigateAfterOnboarding stub — not yet implemented');
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
