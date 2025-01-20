import type {Database} from 'firebase/database';
import {get, ref, child, push, onValue, off} from 'firebase/database';
import type {Profile, ProfileList, UserStatusList} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/** Read data once from the realtime database using get(). Return the data if it exists.
 *
 * @param db The Realtime Database instance.
 * @param refString Ref string to listen at
 * @returns A promise with either the data or null
 * @example
 * const {db} = useFirebase();
 * const myData = await readDataOnce<MyDataType>(db, DBPATHS.SOME_ROUTE.getRoute())
 * */
async function readDataOnce<T>(
  db: Database,
  refString: string,
): Promise<T | null> {
  const userRef = ref(db, refString);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    return snapshot.val() as T;
  }
  return null;
}

/**
 * Main listener for data changes
 *
 * @param db The Realtime Database instance.
 * @param refString Ref string to listen at
 * @param onDataChange Callback function to execute on data change.
 */
function listenForDataChanges<T>(
  db: Database,
  refString: string,
  onDataChange: (data: T | null) => void,
) {
  const dbRef = ref(db, refString);
  const listener = onValue(dbRef, snapshot => {
    let data: T | null = null;
    if (snapshot.exists()) {
      data = snapshot.val() as T;
    }
    onDataChange(data);
  });

  return () => off(dbRef, 'value', listener);
}

/**
 * Generates a database key based on the provided reference string.
 *
 * @param db The database object.
 * @param refString The reference string used to generate the key.
 * @returns The generated database key, or null if the key cannot be generated.
 */
function generateDatabaseKey(db: Database, refString: string): string | null {
  return push(child(ref(db), refString)).key;
}

/**
 * Fetches profile data for multiple users from the database.
 *
 * @param db - The database instance.
 * @param userIDs - An array of user IDs.
 * @param refTemplate - The reference template for fetching user data. Must contain the string '{userID}'.
 * @returns A promise that resolves to an array of profile data.
 */
function fetchDataForUsers(
  db: Database,
  userIDs: UserID[],
  refTemplate: string,
): Promise<Array<Profile | null>> {
  if (!userIDs || userIDs.length === 0) {
    return Promise.resolve([]);
  }
  if (!refTemplate.includes('{userID}')) {
    throw new Error('Invalid ref template');
  }
  return Promise.all(
    userIDs.map(id =>
      readDataOnce<Profile>(db, refTemplate.replace('{userID}', id)),
    ),
  );
}

/**
 * Fetches display data for the given user IDs.
 *
 * @param db - The database instance.
 * @param userIDs - An array of user IDs.
 * @param refTemplate - The reference template for fetching user data. Must contain the string '{userID}'.
 * @returns A promise that resolves to an object containing the display data.
 */
async function fetchDisplayDataForUsers(
  db: Database | undefined,
  userIDs: UserID[],
  refTemplate: string,
): Promise<ProfileList | UserStatusList> {
  const newDisplayData: ProfileList = {};
  if (db && userIDs) {
    const data = await fetchDataForUsers(db, userIDs, refTemplate);
    userIDs.forEach((id, index) => {
      const profile = data[index];
      if (!profile) {
        throw new Error(`Failed to fetch data for a user: ${id}`);
      }
      newDisplayData[id] = profile;
    });
  }
  return newDisplayData;
}

export {
  fetchDataForUsers,
  fetchDisplayDataForUsers,
  generateDatabaseKey,
  listenForDataChanges,
  readDataOnce,
};
