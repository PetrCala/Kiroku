import type {Database} from 'firebase/database';
import {get, ref} from 'firebase/database';

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

// `readDataOnce` is the sole remaining export now that `generateDatabaseKey` has been
// severed (key minting moved to `@libs/generatePushID`). Keep it a named export — its
// call sites and the rest of this shrinking RTDB shim use named imports — rather than
// flipping to a default purely to satisfy this single-export preference.
// eslint-disable-next-line import/prefer-default-export
export {readDataOnce};
