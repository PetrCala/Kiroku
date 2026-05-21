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
function useCurrentUserData() {
  const {auth} = useFirebase();
  const user = auth?.currentUser;
  const userID = user?.uid;
  const [accountUserData] = useOnyx(
    `${ONYXKEYS.COLLECTION.USER_DATA}${userID ?? ''}`,
  );
  const currentUserData: CurrentUserData = useMemo(
    () =>
      (accountUserData ? {...accountUserData, userID} : {}) as CurrentUserData,
    [accountUserData, userID],
  );

  return currentUserData;
}

export default useCurrentUserData;
