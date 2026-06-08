import type {FirebaseStorage} from 'firebase/storage';
import {ref as StorageRef, getDownloadURL} from 'firebase/storage';
import type {Auth, User} from 'firebase/auth';
import {updateProfile} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type {
  GetUsersBatchParams,
  OpenFriendListParams,
  OpenPublicProfilePageParams,
} from '@libs/API/parameters';
import CONST from '@src/CONST';
import type {Profile, ProfileList, UserStatusList} from '@src/types/onyx';
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
 * @param userIDs An array of user IDs.
 * @returns A promise that resolves to a list of user profiles.
 */
async function fetchUserProfiles(userIDs: UserID[]): Promise<ProfileList> {
  if (!userIDs?.length) {
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
 * Fetches the given users' public profile AND privacy-gated status in ONE
 * batched call (`GET /v1/users/batch?fields=profile,status`), replacing the two
 * separate `fetchUserProfiles` + `fetchUserStatuses` round trips the friend list
 * used to fire. The server resolves both field groups concurrently per uid and
 * merges `userDataList[uid].{profile,is_supporter?,user_status}` in one patch, so
 * the SupporterBadge + status render paths are hydrated without extra fetches.
 * A user whose profile is missing (404) is omitted from `profiles`; a status the
 * viewer may not see is `null` (silent eviction), exactly as the single-field
 * readers behaved. Callers that need only one field keep using
 * `fetchUserProfiles`.
 *
 * @param userIDs An array of user IDs.
 * @returns A promise resolving to the profile + status lists keyed by user ID.
 */
async function fetchUsersData(
  userIDs: UserID[],
): Promise<{profiles: ProfileList; statuses: UserStatusList}> {
  if (!userIDs?.length) {
    return {profiles: {}, statuses: {}};
  }
  const patches = await fetchUsersBatch<Partial<UserData>>(
    userIDs,
    'profile,status',
    patch => patch,
  );
  const profiles: ProfileList = {};
  const statuses: UserStatusList = {};
  for (const [userID, patch] of Object.entries(patches)) {
    if (patch.profile) {
      profiles[userID] = patch.profile;
    }
    // Keep a `null` status (the server's silent eviction for a denied/hidden
    // user) so callers see the same "no status" signal the old reader emitted.
    if (patch.user_status !== undefined) {
      statuses[userID] = patch.user_status;
    }
  }
  return {profiles, statuses};
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

/**
 * Read a single user's public profile (profile + public_data + public
 * is_supporter) via `GET /v1/users/:uid/profile`. The response merges those into
 * `userDataList[userID]`; this returns the promise so a caller can await the
 * round-trip. Single-user twin of `fetchUserProfiles` for the profile screen.
 */
function openPublicProfile(userID: UserID): Promise<void | Response> {
  const parameters: OpenPublicProfilePageParams = {userID};
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    READ_COMMANDS.OPEN_PUBLIC_PROFILE_PAGE,
    parameters,
    {},
    CONST.API_REQUEST_TYPE.READ,
  );
}

/**
 * Read a user's friends list via the public `GET /v1/users/:uid/friends`,
 * replacing the direct Firebase RTDB read. The response merges
 * `userDataList[userID].friends`; the profile screen reads it back from Onyx to
 * compute friend / common-friend counts.
 */
function openFriendList(userID: UserID): Promise<void | Response> {
  const parameters: OpenFriendListParams = {userID};
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    READ_COMMANDS.OPEN_FRIEND_LIST,
    parameters,
    {},
    CONST.API_REQUEST_TYPE.READ,
  );
}

export {
  fetchUserProfiles,
  fetchUsersData,
  openPublicProfile,
  openFriendList,
  setProfilePictureURL,
  setSupporterFlagInList,
  updateProfileInfo,
};
