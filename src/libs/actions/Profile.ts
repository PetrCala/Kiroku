import type {Database} from 'firebase/database';
import type {FirebaseStorage} from 'firebase/storage';
import {ref as StorageRef, getDownloadURL} from 'firebase/storage';
import type {Auth, User} from 'firebase/auth';
import {updateProfile} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type {
  OpenFriendStatusParams,
  OpenPublicProfilePageParams,
} from '@libs/API/parameters';
import CONST from '@src/CONST';
import type {ProfileList, UserStatusList} from '@src/types/onyx';
import type Response from '@src/types/onyx/Response';
import type UserData from '@src/types/onyx/UserData';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Pull a single user's merged `userDataList` patch out of a read response's
 * `onyxData`. The cross-user read endpoints all return
 * `merge userDataList { [uid]: { ... } }`; this extracts that `{ ... }` so a
 * caller can return the legacy list shape synchronously. Returns `undefined`
 * when the response carried no such patch (a denied/evicted read or a 404).
 */
function userDataPatchFromResponse(
  response: void | Response,
  userID: UserID,
): Partial<UserData> | undefined {
  if (!response || !Array.isArray(response.onyxData)) {
    return undefined;
  }
  for (const update of response.onyxData) {
    if (
      update.onyxMethod === Onyx.METHOD.MERGE &&
      update.key === ONYXKEYS.USER_DATA_LIST
    ) {
      const value = update.value as
        | Record<UserID, Partial<UserData>>
        | undefined;
      const patch = value?.[userID];
      if (patch) {
        return patch;
      }
    }
  }
  return undefined;
}

/**
 * Fetches the given users' public profiles via the kiroku-api public-profile
 * read (`GET /v1/users/:uid/profile`), replacing the direct Firebase RTDB read.
 * Each response ALSO merges that user's `profile` + public `is_supporter` flag
 * into `USER_DATA_LIST`, so the SupporterBadge data path is hydrated without a
 * separate fetch (this is why the old `fetchAndStoreSupporterFlags` pass is
 * gone). Returns the same `ProfileList` shape the callers render from. A user
 * whose profile is missing (404) is omitted rather than throwing, so one
 * deleted account can't blank the whole list.
 *
 * @param db Unused (retained for call-site compatibility); authority is the
 *   caller's Firebase ID token, attached by the API layer.
 * @param userIDs An array of user IDs.
 * @returns A promise that resolves to a list of user profiles.
 */
async function fetchUserProfiles(
  db: Database,
  userIDs: UserID[],
): Promise<ProfileList> {
  const list: ProfileList = {};
  if (!db || !userIDs?.length) {
    return list;
  }
  await Promise.all(
    userIDs.map(async userID => {
      const parameters: OpenPublicProfilePageParams = {userID};
      // eslint-disable-next-line rulesdir/no-api-side-effects-method
      const response = await API.makeRequestWithSideEffects(
        READ_COMMANDS.OPEN_PUBLIC_PROFILE_PAGE,
        parameters,
        {},
        CONST.API_REQUEST_TYPE.READ,
      );
      const profile = userDataPatchFromResponse(response, userID)?.profile;
      if (profile) {
        list[userID] = profile;
      }
    }),
  );
  return list;
}

/**
 * Mirrors a user's already-known `is_supporter` flag into USER_DATA_LIST.
 * Used by surfaces that have just fetched the value off `users/{userID}`
 * (e.g. the profile screen) so the SupporterBadge wrapper doesn't have to
 * re-fetch.
 */
async function setSupporterFlagInList(
  userID: UserID,
  isSupporter: boolean,
): Promise<void> {
  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [userID]: {is_supporter: isSupporter},
  });
}

/**
 * Fetches the given users' presence + latest session via the privacy-enforced
 * kiroku-api friend-status read (`GET /v1/users/:uid/status`), replacing the
 * direct Firebase RTDB read. The server gates the read (friends + visibility);
 * a denied/hidden user simply yields no entry (the response evicts
 * `userDataList[uid].user_status`). Returns the same `UserStatusList` shape the
 * caller renders from.
 *
 * @param db Unused (retained for call-site compatibility); authority is the
 *   caller's Firebase ID token, attached by the API layer.
 * @param userIDs An array of user IDs.
 * @returns A promise that resolves to a UserStatusList object.
 */
async function fetchUserStatuses(
  db: Database,
  userIDs: UserID[],
): Promise<UserStatusList> {
  const list: UserStatusList = {};
  if (!db || !userIDs?.length) {
    return list;
  }
  await Promise.all(
    userIDs.map(async userID => {
      const parameters: OpenFriendStatusParams = {userID};
      // eslint-disable-next-line rulesdir/no-api-side-effects-method
      const response = await API.makeRequestWithSideEffects(
        READ_COMMANDS.OPEN_FRIEND_STATUS,
        parameters,
        {},
        CONST.API_REQUEST_TYPE.READ,
      );
      const status = userDataPatchFromResponse(response, userID)?.user_status;
      if (status) {
        list[userID] = status;
      }
    }),
  );
  return list;
}

/**
 * Persist a user's new profile photo URL via kiroku-api. The optimistic Onyx
 * update mirrors the server's `onyxData`. Should be called after the picture
 * has been uploaded to storage.
 *
 * @param userID User UID.
 * @param photoURL The download URL of the uploaded profile picture.
 */
function setProfilePictureURL(userID: string, photoURL: string): void {
  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.USER_DATA_LIST,
      value: {[userID]: {profile: {photo_url: photoURL}}},
    },
  ];
  API.write(WRITE_COMMANDS.UPDATE_PROFILE_PHOTO, {photoURL}, {optimisticData});
}

/**
 * Updates the profile information of a user.
 *
 * @param pathToUpload - The path to the file to upload.
 * @param user - The user object.
 * @param auth - The authentication object.
 * @param storage - The Firebase storage object.
 * @returns A promise that resolves when the profile information is updated.
 */
async function updateProfileInfo(
  pathToUpload: string,
  user: User | null,
  auth: Auth,
  storage: FirebaseStorage,
): Promise<void> {
  if (!user || !auth.currentUser) {
    return;
  }
  const downloadURL = await getDownloadURL(StorageRef(storage, pathToUpload));
  setProfilePictureURL(user.uid, downloadURL);
  await updateProfile(auth.currentUser, {photoURL: downloadURL});
}

export {
  fetchUserProfiles,
  fetchUserStatuses,
  setProfilePictureURL,
  setSupporterFlagInList,
  updateProfileInfo,
};
