// TODO this module should hold API actions related to user data
// import type {OnyxEntry, OnyxUpdate} from 'react-native-onyx';
// import Onyx from 'react-native-onyx';
// import * as API from '@libs/API';
import type {} from // OpenPublicProfilePageParams,
// UpdateAutomaticTimezoneParams,
// UpdateDateOfBirthParams,
// UpdateHomeAddressParams,
// UpdateLegalNameParams,
// UpdateSelectedTimezoneParams,
// UpdateUserAvatarParams,
'@libs/API/parameters';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
// import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
// // import type {CustomRNImageManipulatorResult} from '@libs/cropOrRotateImage/types';
import DateUtils from '@libs/DateUtils';
// import Navigation from '@libs/Navigation/Navigation';
// import * as UserDataUtils from '@libs/UserDataUtils';
// import * as UserUtils from '@libs/UserUtils';
// import type {Country} from '@src/CONST';
// import CONST from '@src/CONST';
// import ONYXKEYS from '@src/ONYXKEYS';
// import ROUTES from '@src/ROUTES';
// import type {DateOfBirthForm} from '@src/types/form';
// import type {UserData, UserDataList} from '@src/types/onyx';
// import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {Timezone} from '@src/types/onyx/UserData';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

// let currentUserEmail = '';
// let currentUserID = '';
// Onyx.connect({
//   key: ONYXKEYS.SESSION,
//   callback: val => {
//     currentUserEmail = val?.email ?? '';
//     currentUserID = val?.userID ?? '';
//   },
// });

// let allUserData: OnyxEntry<UserDataList>;
// Onyx.connect({
//   key: ONYXKEYS.USER_DATA_LIST,
//   callback: val => (allUserData = val),
// });

// function updateDisplayName(firstName: string, lastName: string) {
//   if (!currentUserID) {
//     return;
//   }

//   const parameters: UpdateDisplayNameParams = {firstName, lastName};

//   API.write(WRITE_COMMANDS.UPDATE_DISPLAY_NAME, parameters, {
//     optimisticData: [
//       {
//         onyxMethod: Onyx.METHOD.MERGE,
//         key: ONYXKEYS.USER_DATA_LIST,
//         value: {
//           [currentUserID]: {
//             firstName,
//             lastName,
//             displayName: UserDataUtils.createDisplayName(
//               currentUserEmail ?? '',
//               {
//                 firstName,
//                 lastName,
//               },
//             ),
//           },
//         },
//       },
//     ],
//   });
// }

// function updateLegalName(legalFirstName: string, legalLastName: string) {
//   const parameters: UpdateLegalNameParams = {legalFirstName, legalLastName};

//   API.write(WRITE_COMMANDS.UPDATE_LEGAL_NAME, parameters, {
//     optimisticData: [
//       {
//         onyxMethod: Onyx.METHOD.MERGE,
//         key: ONYXKEYS.USER_PRIVATE_DATA,
//         value: {
//           legalFirstName,
//           legalLastName,
//         },
//       },
//     ],
//   });

//   Navigation.goBack();
// }

// /**
//  * @param dob - date of birth
//  */
// function updateDateOfBirth({dob}: DateOfBirthForm) {
//   const parameters: UpdateDateOfBirthParams = {dob};

//   API.write(WRITE_COMMANDS.UPDATE_DATE_OF_BIRTH, parameters, {
//     optimisticData: [
//       {
//         onyxMethod: Onyx.METHOD.MERGE,
//         key: ONYXKEYS.USER_PRIVATE_DATA,
//         value: {
//           dob,
//         },
//       },
//     ],
//   });

//   Navigation.goBack();
// }

// function updateAddress(
//   street: string,
//   street2: string,
//   city: string,
//   state: string,
//   zip: string,
//   country: Country | '',
// ) {
//   const parameters: UpdateHomeAddressParams = {
//     homeAddressStreet: street,
//     addressStreet2: street2,
//     homeAddressCity: city,
//     addressState: state,
//     addressZipCode: zip,
//     addressCountry: country,
//   };

//   // State names for the United States are in the form of two-letter ISO codes
//   // State names for other countries except US have full names, so we provide two different params to be handled by server
//   if (country !== CONST.COUNTRY.US) {
//     parameters.addressStateLong = state;
//   }

//   API.write(WRITE_COMMANDS.UPDATE_HOME_ADDRESS, parameters, {
//     optimisticData: [
//       {
//         onyxMethod: Onyx.METHOD.MERGE,
//         key: ONYXKEYS.USER_PRIVATE_DATA,
//         value: {
//           address: {
//             street: UserDataUtils.getFormattedStreet(street, street2),
//             city,
//             state,
//             zip,
//             country,
//           },
//         },
//       },
//     ],
//   });

//   Navigation.goBack();
// }

/**
 * Updates timezone's 'automatic' setting, and updates
 * selected timezone if set to automatically update.
 */
function updateAutomaticTimezone(timezone: Timezone) {
  // TODO enable this
  // if (Session.isAnonymousUser()) {
  //   return;
  // }
  // Safe to call getFirebaseAuth() here - actions are called after app initialization
  const auth = getFirebaseAuth();
  const currentUserID = auth.currentUser?.uid;

  if (!currentUserID) {
    return;
  }

  const formatedTimezone = DateUtils.formatToSupportedTimezone(timezone);
  // const parameters: UpdateAutomaticTimezoneParams = {
  //   timezone: JSON.stringify(formatedTimezone),
  // };

  Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [currentUserID]: {
      timezone: formatedTimezone,
    },
  });

  // TODO enable this
  // API.write(WRITE_COMMANDS.UPDATE_AUTOMATIC_TIMEZONE, parameters, {
  //   optimisticData: [
  //     {
  //       onyxMethod: Onyx.METHOD.MERGE,
  //       key: ONYXKEYS.USER_DATA_LIST,
  //       value: {
  //         [currentUserID]: {
  //           timezone: formatedTimezone,
  //         },
  //       },
  //     },
  //   ],
  // });
}

// /**
//  * Updates user's 'selected' timezone, then navigates to the
//  * initial Timezone page.
//  */
// function updateSelectedTimezone(selectedTimezone: SelectedTimezone) {
//   const timezone: Timezone = {
//     selected: selectedTimezone,
//   };

//   const parameters: UpdateSelectedTimezoneParams = {
//     timezone: JSON.stringify(timezone),
//   };

//   if (currentUserID) {
//     API.write(WRITE_COMMANDS.UPDATE_SELECTED_TIMEZONE, parameters, {
//       optimisticData: [
//         {
//           onyxMethod: Onyx.METHOD.MERGE,
//           key: ONYXKEYS.USER_DATA_LIST,
//           value: {
//             [currentUserID]: {
//               timezone,
//             },
//           },
//         },
//       ],
//     });
//   }

//   //   Navigation.goBack(ROUTES.SETTINGS_TIMEZONE); // TODO uncomment this
//   Navigation.goBack(ROUTES.HOME);
// }

// /**
//  * Fetches public profile info about a given user.
//  * The API will only return the userID, displayName, and avatar for the user
//  * but the profile page will use other info (e.g. contact methods and pronouns) if they are already available in Onyx
//  */
// function openPublicProfilePage(userID: UserID) {
//   const optimisticData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_METADATA,
//       value: {
//         [userID]: {
//           isLoading: true,
//         },
//       },
//     },
//   ];

//   const successData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_METADATA,
//       value: {
//         [userID]: {
//           isLoading: false,
//         },
//       },
//     },
//   ];

//   const failureData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_METADATA,
//       value: {
//         [userID]: {
//           isLoading: false,
//         },
//       },
//     },
//   ];

//   const parameters: OpenPublicProfilePageParams = {userID};

//   API.read(READ_COMMANDS.OPEN_PUBLIC_PROFILE_PAGE, parameters, {
//     optimisticData,
//     successData,
//     failureData,
//   });
// }

// /**
//  * Updates the user's avatar image
//  */
// // function updateAvatar(file: File | CustomRNImageManipulatorResult) { // TODO uncomment this
// function updateAvatar(file: File | any) {
//   if (!currentUserID) {
//     return;
//   }

//   const optimisticData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_LIST,
//       value: {
//         [currentUserID]: {
//           avatar: file.uri,
//           avatarThumbnail: file.uri,
//           originalFileName: file.name,
//           errorFields: {
//             avatar: null,
//           },
//           pendingFields: {
//             avatar: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
//             originalFileName: null,
//           },
//           fallbackIcon: file.uri,
//         },
//       },
//     },
//   ];
//   const successData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_LIST,
//       value: {
//         [currentUserID]: {
//           pendingFields: {
//             avatar: null,
//           },
//         },
//       },
//     },
//   ];
//   const failureData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_LIST,
//       value: {
//         [currentUserID]: {
//           avatar: allUserData?.[currentUserID]?.avatar,
//           avatarThumbnail:
//             allUserData?.[currentUserID]?.avatarThumbnail ??
//             allUserData?.[currentUserID]?.avatar,
//           pendingFields: {
//             avatar: null,
//           },
//         } as OnyxEntry<Partial<UserData>>,
//       },
//     },
//   ];

//   const parameters: UpdateUserAvatarParams = {file};

//   API.write(WRITE_COMMANDS.UPDATE_USER_AVATAR, parameters, {
//     optimisticData,
//     successData,
//     failureData,
//   });
// }

// /**
//  * Replaces the user's avatar image with a default avatar
//  */
// function deleteAvatar() {
//   if (!currentUserID) {
//     return;
//   }

//   // We want to use the old dot avatar here as this affects both platforms.
//   const defaultAvatar = UserUtils.getDefaultAvatarURL(currentUserID);

//   const optimisticData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_LIST,
//       value: {
//         [currentUserID]: {
//           avatar: defaultAvatar,
//           fallbackIcon: null,
//         },
//       },
//     },
//   ];
//   const failureData: OnyxUpdate[] = [
//     {
//       onyxMethod: Onyx.METHOD.MERGE,
//       key: ONYXKEYS.USER_DATA_LIST,
//       value: {
//         [currentUserID]: {
//           avatar: allUserData?.[currentUserID]?.avatar,
//           fallbackIcon: allUserData?.[currentUserID]?.fallbackIcon,
//         },
//       },
//     },
//   ];

//   API.write(
//     WRITE_COMMANDS.DELETE_USER_AVATAR,
//     {},
//     {optimisticData, failureData},
//   );
// }

// /**
//  * Clear error and pending fields for the current user's avatar
//  */
// function clearAvatarErrors() {
//   if (!currentUserID) {
//     return;
//   }

//   Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
//     [currentUserID]: {
//       errorFields: {
//         avatar: null,
//       },
//       pendingFields: {
//         avatar: null,
//       },
//     },
//   });
// }

export {
  // clearAvatarErrors,
  // deleteAvatar,
  // openPublicProfilePage,
  // updateAddress,
  // eslint-disable-next-line import/prefer-default-export
  updateAutomaticTimezone,
  // updateAvatar,
  // updateDateOfBirth,
  // updateDisplayName,
  // updateLegalName,
  // updateSelectedTimezone,
};
