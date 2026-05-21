import {useFirebase} from '@context/global/FirebaseContext';
import {fetchDataKeyToDbPath} from '@hooks/useFetchData/utils';
import * as Preferences from '@userActions/Preferences';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Preferences as PreferencesType} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {get, ref} from 'firebase/database';
import {useEffect, useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';

type UsePreferencesFetchReturn = {
  /** Latest known snapshot — cached entry first, replaced once the fresh
   *  `get()` resolves. */
  data: PreferencesType | undefined;
  /** True only on the *initial* mount for a given userID and only until
   *  either the cache emits or the first `get()` resolves. Cache hits skip
   *  the loading state entirely. */
  isLoading: boolean;
};

/**
 * Per-user preferences fetcher for friend profiles.
 *
 * Reads `${COLLECTION.PREFERENCES}${userID}` for instant cache, fires a
 * `get()` on `user_preferences/{userID}` in the background, and writes the
 * fresh snapshot back through `Preferences.setLivePreferencesForUser`.
 * Latest-wins request token drops stale responses if the caller swaps the
 * userID before a fetch resolves.
 *
 * Auth-user consumers should keep using `useDatabaseData()` — the live
 * listener in `useListenToData` already write-throughs to the same Onyx slot.
 */
function usePreferencesFetch(userID: UserID): UsePreferencesFetchReturn {
  const {db} = useFirebase();
  const [cached] = useOnyx(`${ONYXKEYS.COLLECTION.PREFERENCES}${userID}`);

  const [isLoading, setIsLoading] = useState<boolean>(!cached);
  const currentTokenRef = useRef(0);
  const hasResolvedRef = useRef(false);

  // If a cache hit arrives after mount (Onyx hydration), turn off loading.
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
    const path = fetchDataKeyToDbPath('preferences', userID);
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
          ? (snapshot.val() as PreferencesType)
          : null;
        Preferences.setLivePreferencesForUser(userID, next);
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

export default usePreferencesFetch;
