import {useFocusEffect} from '@react-navigation/native';
import React, {useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import useNetwork from '@hooks/useNetwork';
import * as Profile from '@userActions/Profile';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ProfileList, UserStatusList} from '@src/types/onyx';
import type {UserArray} from '@src/types/onyx/OnyxCommon';

type UseFriendsDataReturn = {
  /** Profile map for `friendIDs`, read back from `USER_DATA_LIST`. */
  profileList: ProfileList;
  /** Status map for `friendIDs`, read back from `USER_DATA_LIST` (denied/hidden
   *  friends have no entry — the server evicts their status to `null`). */
  userStatusList: UserStatusList;
  /** Cold-load gate ONLY: true just for the first load of a friend set with
   *  nothing cached yet. Never flips back to true for the on-focus refresh, so a
   *  rendered list never blanks back to a full-screen spinner. */
  isLoading: boolean;
};

/**
 * Single source of truth for a friend list's profile + presence data.
 *
 * Fires ONE combined batched read (`Profile.fetchUsersData` →
 * `GET /v1/users/batch?fields=profile,status`) for the whole friend set and
 * reads the result back from the shared `USER_DATA_LIST` Onyx cache the read
 * merges into. Because rendering is driven by Onyx (not a per-mount local
 * `useState` cache, as the old `useProfileList` did), a revisit paints instantly
 * from cache while a background refresh lands (stale-while-revalidate). The read
 * repeats on screen focus so presence stays fresh; a request token makes the
 * loading gate latest-wins so a stale refresh can't flip it out of turn.
 *
 * This replaces the friend list's previous TWO separate fetches (one profile,
 * one status) AND the duplicate `useProfileList` instance, collapsing the
 * Social screen's friend-list fan-out to a single request.
 *
 * @param friendIDs The friends to resolve. Should be a referentially stable
 *   array (e.g. a state value) so the focus effect doesn't re-subscribe each
 *   render.
 */
function useFriendsData(friendIDs: UserArray): UseFriendsDataReturn {
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const [hasResolvedInitial, setHasResolvedInitial] = useState<boolean>(false);

  // Latest-wins request token. A stale on-focus refresh that resolves after a
  // newer one must not flip the cold-load gate.
  const currentTokenRef = useRef(0);

  // Derive the per-friend profile + status maps from the shared cache. Left
  // unmemoized on purpose — the React Compiler handles it; manual memoization is
  // disallowed (CLEAN-REACT-0).
  const profileList: ProfileList = {};
  const userStatusList: UserStatusList = {};
  for (const userID of friendIDs) {
    const entry = userDataList?.[userID];
    if (entry?.profile) {
      profileList[userID] = entry.profile;
    }
    if (entry?.user_status) {
      userStatusList[userID] = entry.user_status;
    }
  }

  const hasCachedData = friendIDs.some(
    userID => !!userDataList?.[userID]?.profile,
  );
  const isLoading =
    friendIDs.length > 0 && !hasCachedData && !hasResolvedInitial;

  useFocusEffect(
    React.useCallback(() => {
      if (friendIDs.length === 0) {
        // Nothing to fetch yet. Don't touch the cold gate here — `isLoading`
        // already returns false for an empty set, and resolving it now would
        // poison the gate for the transient `friends=[]` render that precedes
        // the real list (suppressing the spinner when the friends arrive).
        return;
      }
      const token = ++currentTokenRef.current;
      Profile.fetchUsersData(friendIDs).finally(() => {
        if (token === currentTokenRef.current) {
          setHasResolvedInitial(true);
        }
      });
    }, [friendIDs]),
  );

  // Re-issue the batched read when connectivity resumes. `fetchUsersData` goes
  // through `makeRequestWithSideEffects`, which DISCARDS a read while offline
  // instead of queueing it (unlike `API.write`). `useFocusEffect` only recovers
  // a tab switch, so a stay-on-screen reconnect would leave the list stale —
  // mirror the focus-effect body here (same latest-wins token) so going back
  // online refreshes `USER_DATA_LIST` in place without a tab switch.
  useNetwork({
    onReconnect: () => {
      if (friendIDs.length === 0) {
        return;
      }
      const token = ++currentTokenRef.current;
      Profile.fetchUsersData(friendIDs).finally(() => {
        if (token === currentTokenRef.current) {
          setHasResolvedInitial(true);
        }
      });
    },
  });

  return {profileList, userStatusList, isLoading};
}

export default useFriendsData;
