import * as Profile from '@libs/actions/Profile';
import ONYXKEYS from '@src/ONYXKEYS';
import type UserData from '@src/types/onyx/UserData';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import useNetwork from '@hooks/useNetwork';

type UseFriendProfileReturn = {
  /** The viewed user's public data (profile, public_data, is_supporter, friends),
   *  or `undefined` until loaded. */
  userData: UserData | undefined;
  /** True until both reads (profile + friends) settle. `false` for an empty
   *  `userID`. */
  isLoading: boolean;
};

/**
 * Read a user's public profile + friends list through the kiroku-api
 * (`GET /v1/users/:uid/profile` + `GET /v1/users/:uid/friends`), replacing the
 * direct Firebase RTDB read of `users/$uid` the profile screen did via
 * `useFetchData(['userData'])`. Both responses merge into `userDataList[userID]`
 * (profile + public_data + is_supporter, and friends), which this hook reads
 * back via Onyx. `isLoading` is DERIVED from which userID has settled, so the
 * only setState happens in the async `.finally` below. An empty `userID` is a
 * no-op.
 */
function useFriendProfile(userID: UserID): UseFriendProfileReturn {
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const userData = userID ? userDataList?.[userID] : undefined;

  const [loadedUserID, setLoadedUserID] = useState<UserID | null>(null);

  useEffect(() => {
    if (!userID) {
      return;
    }
    let isActive = true;
    Promise.all([
      Profile.openPublicProfile(userID),
      Profile.openFriendList(userID),
    ]).finally(() => {
      if (isActive) {
        setLoadedUserID(userID);
      }
    });
    return () => {
      isActive = false;
    };
  }, [userID]);

  // Re-issue the reads when connectivity resumes. `openPublicProfile` /
  // `openFriendList` go through `makeRequestWithSideEffects`, which DISCARDS a
  // read while offline instead of queueing it (unlike `API.write`), so an
  // offline mount leaves the profile screen stuck on its empty "go online"
  // state — the `useEffect` above is keyed on `userID` and never re-runs on
  // reconnect. The reads carry no optimistic data, so this refreshes
  // `userDataList[userID]` in place without flashing a loader over cached data.
  useNetwork({
    onReconnect: () => {
      if (!userID) {
        return;
      }
      Profile.openPublicProfile(userID);
      Profile.openFriendList(userID);
    },
  });

  const isLoading = !!userID && loadedUserID !== userID;

  return {userData, isLoading};
}

export default useFriendProfile;
