import type {Database} from 'firebase/database';
import type {FirebaseStorage} from 'firebase/storage';
import {ref as StorageRef, getDownloadURL} from 'firebase/storage';
import type {Auth, User} from 'firebase/auth';
import {updateProfile} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type {GetUsersBatchParams} from '@libs/API/parameters';
import CONST from '@src/CONST';
import type {
  Profile,
  ProfileList,
  UserStatus,
  UserStatusList,
} from '@src/types/onyx';
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

/** The kiroku-api caps each `GET /v1/users/batch` request at 100 uids. */
const USERS_BATCH_CHUNK_SIZE = 100;

/** Split `userIDs` into chunks of at most `USERS_BATCH_CHUNK_SIZE`. */
function chunkUserIDs(userIDs: UserID[]): UserID[][] {
  const chunks: UserID[][] = [];
  for (let i = 0; i < userIDs.length; i += USERS_BATCH_CHUNK_SIZE) {
    chunks.push(userIDs.slice(i, i + USERS_BATCH_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Reads `userIDs` through the batched kiroku-api endpoint
 * (`GET /v1/users/batch`), chunking at the server's 100-uid cap and running the
 * chunks in parallel. This collapses the old per-uid fan-out (~one request per
 * friend, which tripped the per-uid rate limiter) into ~one request per chunk.
 * `fields` selects the projections the server returns; `select` pulls the wanted
 * slice out of each uid's merged `userDataList` patch (via
 * `userDataPatchFromResponse`). A uid the server omits (404 / denied / hidden)
 * yields no entry, preserving the single-user readers' behaviour.
 *
 * @param userIDs The users to read.
 * @param fields Comma-separated projection selector (e.g. `profile`, `status`).
 * @param select Maps a uid's patch to the value stored under that uid, or
 *   `undefined` to omit it.
 * @returns A promise resolving to the keyed list of selected values.
 */
async function fetchUsersBatch<T>(
  userIDs: UserID[],
  fields: string,
  select: (patch: Partial<UserData> | undefined) => T | undefined,
): Promise<Record<UserID, T>> {
  const chunkLists = await Promise.all(
    chunkUserIDs(userIDs).map(async chunk => {
      const parameters: GetUsersBatchParams = {userIDs: chunk, fields};
      // eslint-disable-next-line rulesdir/no-api-side-effects-method
      const response = await API.makeRequestWithSideEffects(
        READ_COMMANDS.GET_USERS_BATCH,
        parameters,
        {},
        CONST.API_REQUEST_TYPE.READ,
      );
      const chunkList: Record<UserID, T> = {};
      for (const userID of chunk) {
        const value = select(userDataPatchFromResponse(response, userID));
        if (value !== undefined) {
          chunkList[userID] = value;
        }
      }
      return chunkList;
    }),
  );
  const list: Record<UserID, T> = {};
  for (const chunkList of chunkLists) {
    Object.assign(list, chunkList);
  }
  return list;
}

/**
 * Fetches the given users' public profiles via the batched kiroku-api read
 * (`GET /v1/users/batch?fields=profile`), replacing the per-uid public-profile
 * fan-out. Each response ALSO merges every returned user's `profile` + public
 * `is_supporter` flag into `USER_DATA_LIST`, so the SupporterBadge data path is
 * hydrated without a separate fetch (this is why the old
 * `fetchAndStoreSupporterFlags` pass is gone). Returns the same `ProfileList`
 * shape the callers render from. A user whose profile is missing (404) is
 * omitted rather than throwing, so one deleted account can't blank the whole
 * list.
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
  if (!db || !userIDs?.length) {
    return {};
  }
  return fetchUsersBatch<Profile>(userIDs, 'profile', patch => patch?.profile);
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
 * Fetches the given users' presence + latest session via the batched
 * privacy-enforced kiroku-api read (`GET /v1/users/batch?fields=status`),
 * replacing the per-uid friend-status fan-out. The server gates each uid
 * (friends + visibility); a denied/hidden user simply yields no entry. Returns
 * the same `UserStatusList` shape the caller renders from.
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
  if (!db || !userIDs?.length) {
    return {};
  }
  return fetchUsersBatch<UserStatus>(
    userIDs,
    'status',
    patch => patch?.user_status,
  );
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
