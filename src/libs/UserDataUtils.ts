import Onyx from 'react-native-onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserData} from '@src/types/onyx';
import * as Localize from './Localize';

let userData: Array<UserData | null> = [];
// let allUserData: OnyxEntry<UserDataList> = {};
Onyx.connect({
  key: ONYXKEYS.USER_DATA_LIST,
  callback: val => {
    userData = Object.values(val ?? {});
    // allUserData = val;
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

// /**
//  * Given a list of logins and userIDs, return Onyx data for users with no existing personal details stored
//  *
//  * @param logins Array of user logins
//  * @param userIDs Array of user userIDs
//  * @returns Object with optimisticData, successData and failureData (object of personal details objects)
//  */
// function getNewUserDataOnyxData(
//   logins: string[],
//   userIDs: UserID[],
// ): Required<Pick<OnyxData, 'optimisticData' | 'finallyData'>> {
//   const userDataNew: UserDataList = {};
//   const userDataCleanup: UserDataList = {};

//   logins.forEach((login, index) => {
//     const userID = userIDs[index];

//     if (allUserData && Object.keys(allUserData?.[userID] ?? {}).length === 0) {
//       userDataNew[userID] = {
//         login,
//         userID,
//         avatar: UserUtils.getDefaultAvatarURL(userID),
//         // displayName: LocalePhoneNumber.formatPhoneNumber(login),
//         displayName: login, // TODO check this
//       };

//       /**
//        * Cleanup the optimistic user to ensure it does not permanently persist.
//        * This is done to prevent duplicate entries (upon success) since the BE will return other personal details with the correct user IDs.
//        */
//       userDataCleanup[userID] = null;
//     }
//   });

//   const optimisticData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_LIST,
//       value: userDataNew,
//     },
//   ];

//   const finallyData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_LIST,
//       value: userDataCleanup,
//     },
//   ];

//   return {
//     optimisticData,
//     finallyData,
//   };
// }

// /**
//  *
//  * @param street1 - street line 1
//  * @param street2 - street line 2
//  * @returns formatted street
//  */
// function getFormattedStreet(street1 = '', street2 = '') {
//   return `${street1}\n${street2}`;
// }

// /**
//  *
//  * @param - formatted address
//  * @returns [street1, street2]
//  */
// function getStreetLines(street = '') {
//   const streets = street.split('\n');
//   return [streets[0], streets[1]];
// }

// /**
//  * Formats an address object into an easily readable string
//  *
//  * @param UserPrivateData - details object
//  * @returns - formatted address
//  */
// function getFormattedAddress(
//   UserPrivateData: OnyxEntry<UserPrivateData>,
// ): string {
//   const {address} = UserPrivateData ?? {};
//   const [street1, street2] = getStreetLines(address?.street);
//   const formattedAddress =
//     formatPiece(street1) +
//     formatPiece(street2) +
//     formatPiece(address?.city) +
//     formatPiece(address?.state) +
//     formatPiece(address?.zip) +
//     formatPiece(address?.country);

//   // Remove the last comma of the address
//   return formattedAddress.trim().replace(/,$/, '');
// }

// /**
//  * @param personalDetail - details object
//  * @returns - The effective display name
//  */
// function getEffectiveDisplayName(
//   personalDetail?: UserData,
// ): string | undefined {
//   if (personalDetail) {
//     return (
//       //   LocalePhoneNumber.formatPhoneNumber(personalDetail?.login ?? '') || // TODO
//       (personalDetail?.login ?? '') || personalDetail.displayName
//     );
//   }

//   return undefined;
// }

// /**
//  * Creates a new displayName for a user based on passed personal details or login.
//  */
// function createDisplayName(
//   login: string,
//   passedUserData:
//     | Pick<UserData, 'firstName' | 'lastName'>
//     | OnyxEntry<UserData>,
// ): string {
//   // If we have a number like +15857527441@expensify.sms then let's remove @expensify.sms and format it
//   // so that the option looks cleaner in our UI.
//   //   const userLogin = LocalePhoneNumber.formatPhoneNumber(login);
//   const userLogin = login; // TODO temporary, ignoring the phone formatting

//   if (!passedUserData) {
//     return userLogin;
//   }

//   const firstName = passedUserData.firstName ?? '';
//   const lastName = passedUserData.lastName ?? '';
//   const fullName = `${firstName} ${lastName}`.trim();

//   // It's possible for fullName to be empty string, so we must use "||" to fallback to userLogin.
//   return fullName || userLogin;
// }

// TODO enable later
// /**
//  * Gets the first and last name from the user's personal details.
//  * If the login is the same as the displayName, then they don't exist,
//  * so we return empty strings instead.
//  */
// function extractFirstAndLastNameFromAvailableDetails({
//   login,
//   displayName,
//   firstName,
//   lastName,
// }: CurrentUserData): FirstAndLastName {
//   // It's possible for firstName to be empty string, so we must use "||" to consider lastName instead.
//   // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
//   if (firstName || lastName) {
//     return {firstName: firstName ?? '', lastName: lastName ?? ''};
//   }
//   //   if (login && Str.removeSMSDomain(login) === displayName) {
//   if (login && login === displayName) {
//     return {firstName: '', lastName: ''};
//   }

//   if (displayName) {
//     const firstSpaceIndex = displayName.indexOf(' ');
//     const lastSpaceIndex = displayName.lastIndexOf(' ');
//     if (firstSpaceIndex === -1) {
//       return {firstName: displayName, lastName: ''};
//     }

//     return {
//       firstName: displayName.substring(0, firstSpaceIndex).trim(),
//       lastName: displayName.substring(lastSpaceIndex).trim(),
//     };
//   }

//   return {firstName: '', lastName: ''};
// }

/**
 * Whether personal details is empty
 */
function isUserDataEmpty() {
  return !userData.length;
}

export {
  isUserDataEmpty,
  getDisplayNameOrDefault,
  // getNewUserDataOnyxData,
  // getFormattedStreet,
  // getStreetLines,
  // getEffectiveDisplayName,
  // createDisplayName,
  // extractFirstAndLastNameFromAvailableDetails,
};
