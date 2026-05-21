import {useFirebase} from '@context/global/FirebaseContext';
import {fetchDataKeyToDbPath} from '@hooks/useFetchData/utils';
import * as UserData from '@userActions/UserData';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserData as UserDataType} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {get, ref} from 'firebase/database';
import {useEffect, useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';

type UseUserDataFetchReturn = {
  /** Latest known `users/{uid}` snapshot — cached entry first, replaced once
   *  the fresh `get()` resolves. */
  data: UserDataType | undefined;
  /** True only on the *initial* mount for a given userID and only until
   *  either the cache emits or the first `get()` resolves. */
  isLoading: boolean;
};

/**
 * Per-user `users/{uid}` fetcher for friend profiles.
 *
 * Mirrors [[usePreferencesFetch]]: cache-first read from
 * `${COLLECTION.USER_DATA}${userID}`, background `get()`, write-through via
 * `UserData.setLiveUserDataForUser`. Latest-wins request token.
 */
function useUserDataFetch(userID: UserID): UseUserDataFetchReturn {
  const {db} = useFirebase();
  const [cached] = useOnyx(`${ONYXKEYS.COLLECTION.USER_DATA}${userID}`);

  const [isLoading, setIsLoading] = useState<boolean>(!cached);
  const currentTokenRef = useRef(0);
  const hasResolvedRef = useRef(false);

  useEffect(() => {
    if (cached && !hasResolvedRef.current) {
      hasResolvedRef.current = true;
      setIsLoading(false);
    }
  }, [cached]);

  useEffect(() => {
    if (!db || !userID) {
      return;
    }
    const path = fetchDataKeyToDbPath('userData', userID);
    if (!path) {
      return;
    }
    const token = ++currentTokenRef.current;
    get(ref(db, path))
      .then(snapshot => {
        if (token !== currentTokenRef.current) {
          return;
        }
        const next = snapshot.exists()
          ? (snapshot.val() as UserDataType)
          : null;
        UserData.setLiveUserDataForUser(userID, next);
        if (!hasResolvedRef.current) {
          hasResolvedRef.current = true;
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (token !== currentTokenRef.current) {
          return;
        }
        if (!hasResolvedRef.current) {
          hasResolvedRef.current = true;
          setIsLoading(false);
        }
      });
  }, [db, userID]);

  return {data: cached ?? undefined, isLoading};
}

export default useUserDataFetch;
