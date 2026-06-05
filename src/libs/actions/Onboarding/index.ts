import type {User} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import * as Localize from '@libs/Localize';
import Navigation from '@libs/Navigation/Navigation';
import {setUsername} from '@userActions/User';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

/**
 * Onboarding writes, cut over from direct Firebase RTDB writes to kiroku-api
 * `API.write` calls (#778). Authority is server-side (the caller's Firebase ID
 * token), so the uid is used only for the optimistic Onyx update, which mirrors
 * each server route's `onyxData` to keep the inline/pushed response idempotent.
 *
 * `setDisplayName` still wraps {@link setUsername}, which has no server endpoint
 * yet and remains a direct Firebase write — a separate chip cuts it over.
 */

function getCurrentUserID(): string | undefined {
  return getFirebaseAuth().currentUser?.uid ?? undefined;
}

/**
 * Persist the onboarding resume point via `POST /v1/onboarding/last-visited-path`.
 * Optimistic data mirrors the route's `onyxData`. No-op when signed out.
 */
function writeLastVisitedPath(path: string, uid: string | undefined): void {
  if (!uid) {
    return;
  }
  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.NVP_ONBOARDING,
      value: {last_visited_path: path},
    },
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.USER_DATA_LIST,
      value: {[uid]: {onboarding: {last_visited_path: path}}},
    },
  ];
  API.write(
    WRITE_COMMANDS.SET_ONBOARDING_LAST_VISITED_PATH,
    {path},
    {optimisticData},
  );
}

/**
 * Record acceptance of the current Terms & Conditions via
 * `POST /v1/onboarding/accept-terms`.
 *
 * The server decides the accepted version, so the client never sends one; the
 * locally known `CURRENT_TERMS_VERSION` is used purely for the optimistic echo
 * (the server's response is authoritative). Optimistic data mirrors the route's
 * `onyxData`.
 *
 * @param onboardingPath When acceptance happens inside the onboarding flow, the
 *  route to record as the resume point. Omit for standalone re-consent so
 *  onboarding state is not mutated for users who have already finished.
 */
function acceptTerms(onboardingPath?: string): void {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  const now = Date.now();
  const version = CONST.CURRENT_TERMS_VERSION;
  const hasPath = onboardingPath !== undefined;

  const userEntry: Record<string, unknown> = {
    agreed_to_terms_at: now,
    agreed_to_terms_version: version,
  };
  if (hasPath) {
    userEntry.onboarding = {last_visited_path: onboardingPath};
  }

  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.USER_DATA_LIST,
      value: {[uid]: userEntry},
    },
    {
      onyxMethod: Onyx.METHOD.SET,
      key: ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION,
      value: version,
    },
  ];
  if (hasPath) {
    optimisticData.push({
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.NVP_ONBOARDING,
      value: {last_visited_path: onboardingPath},
    });
  }

  API.write(WRITE_COMMANDS.ACCEPT_TERMS, hasPath ? {onboardingPath} : {}, {
    optimisticData,
  });
}

/**
 * Persist the display name chosen during onboarding.
 *
 * Wraps {@link setUsername} (now served by kiroku-api — it writes
 * `profile.display_name`, flips `profile.username_chosen`, rebuilds the
 * nickname index, and syncs the Firebase auth profile) and additionally
 * records the onboarding resume path via kiroku-api so the flow resumes where
 * it left off.
 *
 * `setUsername` is fire-and-forget (optimistic API write), so it is not
 * awaited; only the resume-path write is awaited here.
 */
async function setDisplayName(
  user: User | null,
  newDisplayName: string,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  setUsername(user, newDisplayName);

  writeLastVisitedPath(ROUTES.ONBOARDING_DISPLAY_NAME, user.uid);
}

/**
 * Mark the onboarding flow complete via `POST /v1/onboarding/complete`.
 *
 * The optimistic completion merge is applied and awaited BEFORE the server
 * write so `shouldFireOnboarding` flips to false before the caller's dismissal
 * pop — otherwise `OnboardingGuard` races the dismissal and re-routes the user
 * back into onboarding. Awaiting guarantees the flip has propagated, so this
 * cannot use `API.write`'s fire-and-forget optimistic update.
 */
async function completeOnboarding(): Promise<void> {
  const uid = getCurrentUserID();
  if (!uid) {
    return;
  }
  const now = Date.now();

  await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {completed_at: now});
  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [uid]: {onboarding: {completed_at: now}},
  });

  API.write(WRITE_COMMANDS.COMPLETE_ONBOARDING, {});
}

/**
 * Dismiss the onboarding modal and reveal the Home screen underneath.
 *
 * Pops the `ONBOARDING_MODAL_NAVIGATOR` route directly off the root stack.
 * Going through `Navigation.navigate(ROUTES.HOME)` is wrong here: the
 * shared `linkTo` resolver treats `/home` as a bottom-tab destination and
 * dispatches BOTH a PUSH onto the BottomTabNavigator's stack AND a
 * POP_TO_TOP on the root, producing two simultaneous rightward animations
 * (the modal flying out while a duplicate HOME slides in) and leaving a
 * stale duplicate `HOME` route on the bottom-tab stack.
 *
 * Call this AFTER `completeOnboarding` so `shouldFireOnboarding` has
 * already flipped to false by the time the pop dispatches — otherwise
 * `OnboardingGuard` races us and re-routes the user back into onboarding.
 * Resuming the last-attempted protected route is a v2 nice-to-have.
 */
function navigateAfterOnboarding(): void {
  Navigation.dismissModal();
}

function setLastVisitedPath(path: string): void {
  writeLastVisitedPath(path, getCurrentUserID());
}

export {
  acceptTerms,
  setDisplayName,
  completeOnboarding,
  navigateAfterOnboarding,
  setLastVisitedPath,
};
