import type {Database} from 'firebase/database';
import {get, ref, child, push} from 'firebase/database';

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
 * Generates a database key based on the provided reference string.
 *
 * NOTE: This is the last RTDB-handle dependency on the write path. It performs
 * NO network call — `push()` derives a chronologically-sortable unique key
 * locally from the SDK's pushId algorithm. It could be replaced by a UUID
 * (e.g. `expo-crypto` randomUUID) to fully sever the `db` handle from session
 * creation; see contributingGuides/REALTIME_MIGRATION_AUDIT.md.
 *
 * @param db The database object.
 * @param refString The reference string used to generate the key.
 * @returns The generated database key, or null if the key cannot be generated.
 */
function generateDatabaseKey(db: Database, refString: string): string | null {
  return push(child(ref(db), refString)).key;
}

export {generateDatabaseKey, readDataOnce};
