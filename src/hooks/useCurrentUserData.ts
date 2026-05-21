import {useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserData} from '@src/types/onyx';
import {useFirebase} from '@context/global/FirebaseContext';

type CurrentUserData = UserData | Record<string, never>;

/**
 * Read the auth user's `users/{uid}` entry from the per-user Onyx collection.
 * Returns an empty object before the entry has been hydrated so callers don't
 * have to nullable-guard every field access (matches the previous semantics).
 */
// An obviously-invalid UID placeholder used before auth resolves. The bare
// `${prefix}` would be interpreted by useOnyx as the *whole* collection key,
// and useOnyx refuses to transition between a whole-collection key and a
// specific-member key — so the suffix must always be non-empty.
const NO_USER_ID_SENTINEL = '-1';

function useCurrentUserData() {
  const {auth} = useFirebase();
  const user = auth?.currentUser;
  const userID = user?.uid;
  const [accountUserData] = useOnyx(
    `${ONYXKEYS.COLLECTION.USER_DATA}${userID ?? NO_USER_ID_SENTINEL}`,
  );
  const currentUserData: CurrentUserData = useMemo(
    () =>
      (accountUserData ? {...accountUserData, userID} : {}) as CurrentUserData,
    [accountUserData, userID],
  );

  return currentUserData;
}

export default useCurrentUserData;
