// TODO this module should hold API actions related to user data
import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import type {
  UpdateAutomaticTimezoneParams,
  UpdateSelectedTimezoneParams,
} from '@libs/API/parameters';
import DateUtils from '@libs/DateUtils';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import ONYXKEYS from '@src/ONYXKEYS';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/UserData';

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
 * Build the optimistic Onyx update mirroring the server's `onyxData` for a
 * timezone write — a MERGE of the full `{selected, automatic}` object onto the
 * current user's `userDataList` entry.
 */
function timezoneOptimisticData(
  currentUserID: string,
  timezone: Timezone,
): OnyxUpdate[] {
  return [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.USER_DATA_LIST,
      value: {
        [currentUserID]: {timezone},
      },
    },
  ];
}

/**
 * Persist the user's timezone via the kiroku-api preferences endpoint,
 * normalizing deprecated IANA names first. The server replaces
 * `users/$uid/timezone` with the object sent, so callers MUST pass the complete
 * `{selected, automatic}` — a partial write would drop the other field.
 */
function updateAutomaticTimezone(timezone: Timezone) {
  const auth = getFirebaseAuth();
  const currentUserID = auth.currentUser?.uid;

  if (!currentUserID) {
    return;
  }

  const formattedTimezone = DateUtils.formatToSupportedTimezone(timezone);
  const parameters: UpdateAutomaticTimezoneParams = {
    timezone: formattedTimezone,
  };

  API.write(WRITE_COMMANDS.UPDATE_AUTOMATIC_TIMEZONE, parameters, {
    optimisticData: timezoneOptimisticData(currentUserID, formattedTimezone),
  });
}

/**
 * Persist a manually selected timezone. Selecting a zone implies turning the
 * automatic setting off, so the full `{selected, automatic: false}` object is
 * written.
 */
function saveSelectedTimezone(selectedTimezone: SelectedTimezone) {
  const auth = getFirebaseAuth();
  const currentUserID = auth.currentUser?.uid;

  if (!currentUserID) {
    return;
  }

  const formattedTimezone = DateUtils.formatToSupportedTimezone({
    selected: selectedTimezone,
    automatic: false,
  });
  const parameters: UpdateSelectedTimezoneParams = {
    timezone: formattedTimezone,
  };

  API.write(WRITE_COMMANDS.UPDATE_SELECTED_TIMEZONE, parameters, {
    optimisticData: timezoneOptimisticData(currentUserID, formattedTimezone),
  });
}

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

export {updateAutomaticTimezone, saveSelectedTimezone};
