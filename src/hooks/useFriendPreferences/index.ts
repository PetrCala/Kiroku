import * as Preferences from '@libs/actions/Preferences';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Preferences as PreferencesType} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import useNetwork from '@hooks/useNetwork';

type UseFriendPreferencesReturn = {
  /** The friend's rendering preferences, or `undefined` until loaded / when the
   *  server denies access (a denied/hidden read evicts the key — Kiroku #786). */
  preferences: PreferencesType | undefined;
  /** True until this user's read settles. `false` for an empty `userID` (the
   *  self branch of screens that show both). */
  isLoading: boolean;
};

/**
 * Read a FRIEND's rendering preferences (units/colors) through the
 * privacy-enforced `GET /v1/users/:uid/preferences` API — previously a direct
 * Firebase RTDB read via `useFetchData(['preferences'])`. The server gates the
 * read (friends + visibility) and delivers the prefs into
 * `userDataList[userID].preferences`, which this hook reads back via Onyx; a
 * denied/hidden read evicts that key so `preferences` becomes `undefined` the
 * moment access is lost. An empty `userID` is a no-op.
 */
function useFriendPreferences(userID: UserID): UseFriendPreferencesReturn {
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const preferences = userID ? userDataList?.[userID]?.preferences : undefined;

  // Track the last userID whose read has settled; `isLoading` is DERIVED from it
  // rather than set synchronously in the effect (which cascades renders). The
  // only setState happens in the async `.finally` callback below.
  const [loadedUserID, setLoadedUserID] = useState<UserID | null>(null);

  useEffect(() => {
    if (!userID) {
      return;
    }
    let isActive = true;
    Preferences.openFriendPreferences(userID).finally(() => {
      if (isActive) {
        setLoadedUserID(userID);
      }
    });
    return () => {
      isActive = false;
    };
  }, [userID]);

  // Re-issue the read when connectivity resumes. `openFriendPreferences` goes
  // through `makeRequestWithSideEffects`, which DISCARDS a read while offline
  // instead of queueing it (unlike `API.write`), and the effect above is keyed
  // on `userID` so it never re-runs on reconnect — without this the profile
  // calendar's units/colors stay missing after going back online.
  useNetwork({
    onReconnect: () => {
      if (!userID) {
        return;
      }
      Preferences.openFriendPreferences(userID);
    },
  });

  const isLoading = !!userID && loadedUserID !== userID;

  return {preferences, isLoading};
}

export default useFriendPreferences;
