// import Str from 'expensify-common/lib/str';
import Onyx from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import CONST from '@src/CONST';
import type {Timestamp, UserID} from '@src/types/onyx/OnyxCommon';
import type IconAsset from '@src/types/utils/IconAsset';
import ONYXKEYS from '@src/ONYXKEYS';
import type {User} from 'firebase/auth';
import type {UserDataList, UserPrivateData} from '@src/types/onyx/UserData';
import hashCode from './hashCode';

let appUpdateDismissed: OnyxEntry<Timestamp | null> = null;
Onyx.connect({
  key: ONYXKEYS.APP_UPDATE_DISMISSED,
  callback: val => {
    appUpdateDismissed = val;
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AvatarRange =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24;

type AvatarSource = IconAsset | string;

type LoginListIndicator =
  | ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS>
  | undefined;

/**
 * Searches through given loginList for any contact method / login with an error.
 *
 * Example that should return false:
 * {{
 *      test@test.com: {
 *          errorFields: {
 *              validateCodeSent: null
 *          }
 *      }
 * }}
 *
 * Example that should return true:
 * {{
 *      test@test.com: {
 *          errorFields: {
 *              validateCodeSent: { 18092081290: 'An error' }
 *          }
 *      }
 * }}
 */
// function hasLoginListError(loginList: OnyxEntry<LoginList>): boolean {
//   return Object.values(loginList ?? {}).some(loginData =>
//     Object.values(loginData.errorFields ?? {}).some(
//       field => Object.keys(field ?? {}).length > 0,
//     ),
//   );
// }

/**
 * Searches through given loginList for any contact method / login that requires
 * an Info brick road status indicator. Currently this only applies if the user
 * has an unvalidated contact method.
 */
// function hasLoginListInfo(loginList: OnyxEntry<LoginList>): boolean {
//   return !Object.values(loginList ?? {}).every(field => field.validatedDate);
// }

// /**
//  * Gets the appropriate brick road indicator status for a given loginList.
//  * Error status is higher priority, so we check for that first.
//  */
// function getLoginListBrickRoadIndicator(
//   loginList: OnyxEntry<LoginList>,
// ): LoginListIndicator {
//   if (hasLoginListError(loginList)) {
//     return CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR;
//   }
//   if (hasLoginListInfo(loginList)) {
//     return CONST.BRICK_ROAD_INDICATOR_STATUS.INFO;
//   }
//   return undefined;
// }

/**
 * Hashes provided string and returns a value between [0, range)
 */
function hashText(text: string, range: number): number {
  return Math.abs(hashCode(text.toLowerCase())) % range;
}

/**
 * Generate a random userID base on searchValue.
 */
function generateUserID(searchValue: string): number {
  return hashText(searchValue, 2 ** 32);
}

/**
 * Helper method to return the default avatar associated with the given userID
 * @param [userID]
 * @returns
 */
function getDefaultAvatar(
  userID: UserID = '-1',
  avatarURL?: string,
): IconAsset {
  if (userID === '-1') {
    return KirokuIcons.UserIcon;
  }

  return {uri: avatarURL ?? ''};
}

/**
 * Helper method to return default avatar URL associated with the userID
 */
function getDefaultAvatarURL(): IconAsset {
  return KirokuIcons.UserIcon;
}

/**
 * Given a user's avatar path, returns true if user doesn't have an avatar or if URL points to a default avatar
 * @param avatarSource - the avatar source from user's personalDetails
 */
function isDefaultAvatar(
  avatarSource?: AvatarSource,
): avatarSource is string | undefined {
  if (typeof avatarSource === 'string') {
    if (
      avatarSource.includes('images/avatars/avatar_') ||
      avatarSource.includes('images/avatars/default-avatar_') ||
      avatarSource.includes('images/avatars/user/default')
    ) {
      return true;
    }
  }

  if (!avatarSource) {
    // If source is undefined, we should also use a default avatar
    return true;
  }

  return false;
}

/**
 * Provided an avatar source, if source is a default avatar, return the associated SVG.
 * Otherwise, return the URL or SVG pointing to the user-uploaded avatar.
 *
 * @param avatarSource - the avatar source from user's personalDetails
 * @param userID - the userID of the user
 */
function getAvatar(avatarSource?: AvatarSource, userID?: UserID): AvatarSource {
  return isDefaultAvatar(avatarSource)
    ? getDefaultAvatar(userID, avatarSource)
    : avatarSource;
}

/**
 * Provided an avatar URL, if avatar is a default avatar, return NewDot default avatar URL.
 * Otherwise, return the URL pointing to a user-uploaded avatar.
 *
 * @param avatarURL - the avatar source from user's personalDetails
 * @param userID - the userID of the user
 */
function getAvatarUrl(avatarSource: AvatarSource | undefined): AvatarSource {
  return isDefaultAvatar(avatarSource) ? getDefaultAvatarURL() : avatarSource;
}

/**
 * Avatars uploaded by users will have a _128 appended so that the asset server returns a small version.
 * This removes that part of the URL so the full version of the image can load.
 */
function getFullSizeAvatar(
  avatarSource: AvatarSource | undefined,
  userID?: UserID,
): AvatarSource {
  const source = getAvatar(avatarSource, userID);
  if (typeof source !== 'string') {
    return source;
  }
  return source.replace('_128', '');
}

/**
 * Small sized avatars end with _128.<file-type>. This adds the _128 at the end of the
 * source URL (before the file type) if it doesn't exist there already.
 */
function getSmallSizeAvatar(
  avatarSource: AvatarSource,
  userID?: UserID,
): AvatarSource {
  const source = getAvatar(avatarSource, userID);
  if (typeof source !== 'string') {
    return source;
  }

  // If image source already has _128 at the end, the given avatar URL is already what we want to use here.
  const lastPeriodIndex = source.lastIndexOf('.');
  if (source.substring(lastPeriodIndex - 4, lastPeriodIndex) === '_128') {
    return source;
  }
  return `${source.substring(0, lastPeriodIndex)}_128${source.substring(
    lastPeriodIndex,
  )}`;
}

// /**
//  * Gets the secondary phone login number
//  */
// function getSecondaryPhoneLogin(
//   loginList: OnyxEntry<Login>,
// ): string | undefined {
//   const parsedLoginList = Object.keys(loginList ?? {}).map(login =>
//     Str.removeSMSDomain(login),
//   );
//   return parsedLoginList.find(login => Str.isValidE164Phone(login));
// }

/**
 * Non-production-only session bypass for the mandatory email-verification modal.
 * Set by the "Skip verification (dev only)" affordance inside VerifyEmailModal.
 * Module-scoped so it resets on every cold app restart — there is no Onyx
 * persistence by design, and no clearing on logout (the bypass is per-device
 * session, not per-user, so QA cycles don't re-trigger the modal on every
 * sign-out/sign-in).
 */
let devBypassEmailVerification = false;

function setDevBypassEmailVerification(bypass: boolean): void {
  devBypassEmailVerification = bypass;
}

/**
 * Returns the current user's supporter status from private data, with safe
 * defaults. Undefined fields read as a non-supporter — mirrors the
 * onboarding-epic convention of treating absent flags as the "off" state.
 * Pass the value of `ONYXKEYS.USER_PRIVATE_DATA` from the caller (e.g. via
 * `useOnyx`) to keep this selector pure.
 */
function getCurrentUserSupporterStatus(
  privateData: OnyxEntry<UserPrivateData>,
): Required<Pick<UserPrivateData, 'is_supporter'>> &
  Pick<
    UserPrivateData,
    | 'supporter_since'
    | 'supporter_tier'
    | 'supporter_expires_at'
    | 'supporter_status'
  > {
  return {
    is_supporter: privateData?.is_supporter ?? false,
    supporter_since: privateData?.supporter_since ?? null,
    supporter_tier: privateData?.supporter_tier ?? null,
    supporter_expires_at: privateData?.supporter_expires_at ?? null,
    supporter_status: privateData?.supporter_status ?? null,
  };
}

/**
 * Public-facing supporter check that works for any user (current or friend).
 * Reads the public mirror written server-side by the RevenueCat webhook.
 * Falls back to the caller-supplied private flag when querying self, so the
 * badge renders correctly even before the webhook has caught up. Pass Onyx
 * data in from `useOnyx` to keep this selector pure.
 */
function getUserIsSupporter(
  userId: UserID | undefined,
  userDataList: OnyxEntry<UserDataList>,
  currentUserId?: UserID,
  currentUserPrivateData?: OnyxEntry<UserPrivateData>,
): boolean {
  if (!userId) {
    return false;
  }
  const publicFlag = userDataList?.[userId]?.is_supporter ?? false;
  if (userId === currentUserId) {
    return currentUserPrivateData?.is_supporter ?? publicFlag;
  }
  return publicFlag;
}

function shouldShowVerifyEmailModal(user: User | null): boolean {
  if (devBypassEmailVerification) {
    return false;
  }
  return !!user && !user.emailVerified;
}

/**
 * Determines if the update modal should be shown based on the given parameters.
 *
 * @param updateAvailable Whether an update is available
 * @param updateRequired Whether an update is required
 * @returns A boolean indicating whether the update modal should be shown
 */
function shouldShowUpdateModal(
  updateAvailable: boolean,
  updateRequired: boolean,
): boolean {
  const updateDismissedRecently =
    appUpdateDismissed &&
    appUpdateDismissed > Date.now() - CONST.APP_UPDATE.DISMISS_TIME;
  return updateAvailable && !updateRequired && !updateDismissedRecently;
}

export {
  generateUserID,
  getAvatar,
  getAvatarUrl,
  getCurrentUserSupporterStatus,
  getDefaultAvatar,
  getDefaultAvatarURL,
  getFullSizeAvatar,
  // getLoginListBrickRoadIndicator,
  // getSecondaryPhoneLogin,
  getSmallSizeAvatar,
  getUserIsSupporter,
  // hasLoginListError,
  // hasLoginListInfo,
  hashText,
  isDefaultAvatar,
  setDevBypassEmailVerification,
  shouldShowVerifyEmailModal,
  shouldShowUpdateModal,
};
export type {AvatarSource, LoginListIndicator};
