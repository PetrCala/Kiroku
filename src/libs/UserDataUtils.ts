import Onyx from 'react-native-onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserData} from '@src/types/onyx';
import * as Localize from './Localize';

let userData: Array<UserData | null> = [];
Onyx.connect({
  key: ONYXKEYS.USER_DATA_LIST,
  callback: val => {
    userData = Object.values(val ?? {});
  },
});

function getDisplayNameOrDefault(
  passedUserData?: Partial<UserData> | null,
  defaultValue = '',
  shouldFallbackToHidden = true,
  shouldAddCurrentUserPostfix = false,
): string {
  let displayName = passedUserData?.profile?.display_name ?? '';

  // If the displayName starts with the merged account prefix, remove it.
  if (displayName.startsWith(CONST.MERGED_ACCOUNT_PREFIX)) {
    // Remove the merged account prefix from the displayName.
    displayName = displayName.substring(CONST.MERGED_ACCOUNT_PREFIX.length);
  }

  // If the displayName is not set by the user, the backend sets the diplayName same as the login so
  // we need to remove the sms domain from the displayName if it is an sms login.
  // Not implemented yet in Kiroku
  //   if (
  //     displayName === passedUserData?.login &&
  //     Str.isSMSLogin(passedUserData?.login)
  //   ) {
  //     displayName = Str.removeSMSDomain(displayName);
  //   }

  if (shouldAddCurrentUserPostfix && !!displayName) {
    displayName = `${displayName} (${Localize.translateLocal('common.you').toLowerCase()})`;
  }

  if (displayName) {
    return displayName;
  }
  return (
    defaultValue ||
    (shouldFallbackToHidden ? Localize.translateLocal('common.hidden') : '')
  );
}

/**
 * Whether personal details is empty
 */
function isUserDataEmpty() {
  return !userData.length;
}

export {isUserDataEmpty, getDisplayNameOrDefault};
