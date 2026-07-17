import {useFocusEffect} from '@react-navigation/native';
import React, {useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import useNetwork from '@hooks/useNetwork';
import * as Profile from '@userActions/Profile';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ProfileList, UserStatusList} from '@src/types/onyx';
import type {UserArray} from '@src/types/onyx/OnyxCommon';
import {hasSyncedThisAppRun, markSyncedThisAppRun} from './sessionSync';

type UseFriendsDataReturn = {
  /** Profile map for `friendIDs`, read back from `USER_DATA_LIST`. */
  profileList: ProfileList;
  /** Status map for `friendIDs`, read back from `USER_DATA_LIST` (denied/hidden
   *  friends have no entry; the server evicts their status to `null`). */
  userStatusList: UserStatusList;
  /** Cold-load gate: true while the FIRST live sync of this app run is still
   *  pending (even when a persisted cache exists; see the freshness note in
   *  the hook docblock) and for the first-ever load with nothing cached. Never
   *  flips back to true for a background refresh, so a rendered list never
   *  blanks back to placeholders. */
  isLoading: boolean;
};

/**
 * Single source of truth for a friend list's profile + presence data.
 *
 * Fires ONE combined batched read (`Profile.fetchUsersData` →
 * `GET /v1/users/batch?fields=profile,status`) for the whole friend set and
 * reads the result back from the shared `USER_DATA_LIST` Onyx cache the read
 * merges into. The read repeats on screen focus so presence stays fresh; a
 * request token makes the loading gate latest-wins so a stale refresh can't
 * flip it out of turn.
 *
 * Freshness policy: `USER_DATA_LIST` persists across app restarts, so cache
 * PRESENCE says nothing about cache AGE. The first open of an app run
 * therefore holds `isLoading` until the live fetch settles, bounded by
 * `TIMING.FRIENDS_COLD_SYNC_TIMEOUT` (slow network → fall back to painting
 * the cache) and skipped entirely while offline with a cache (reads are
 * discarded offline, so there is nothing fresh to wait for; the reconnect
 * handler refreshes in place). Every later mount is stale-while-revalidate: a
 * revisit paints instantly from cache while a background refresh lands.
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

  // Re-issue the batched read when connectivity resumes. `fetchUsersData` goes
  // through `makeRequestWithSideEffects`, which DISCARDS a read while offline
  // instead of queueing it (unlike `API.write`). `useFocusEffect` only recovers
  // a tab switch, so a stay-on-screen reconnect would leave the list stale:
  // mirror the focus-effect body here (same latest-wins token) so going back
  // online refreshes `USER_DATA_LIST` in place without a tab switch.
  const {isOffline} = useNetwork({
    onReconnect: () => {
      if (friendIDs.length === 0) {
        return;
      }
      const token = ++currentTokenRef.current;
      Profile.fetchUsersData(friendIDs)
        .finally(() => {
          markSyncedThisAppRun();
          if (token === currentTokenRef.current) {
            setHasResolvedInitial(true);
          }
        })
        .catch(() => undefined);
    },
  });

  // Derive the per-friend profile + status maps from the shared cache. Left
  // unmemoized on purpose: the React Compiler handles it; manual memoization is
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
  // The cache is cold when there is nothing in it at all OR when it predates
  // this app run (persisted snapshot of unknown age). Either way the gate holds
  // until this mount's fetch settles or times out, except offline with a
  // cache, where nothing fresh can arrive and stale beats blank.
  const isColdCache = !hasCachedData || !hasSyncedThisAppRun();
  const isLoading =
    friendIDs.length > 0 &&
    isColdCache &&
    !hasResolvedInitial &&
    !(hasCachedData && isOffline);

  useFocusEffect(
    React.useCallback(() => {
      if (friendIDs.length === 0) {
        // Nothing to fetch yet. Don't touch the cold gate here: `isLoading`
        // already returns false for an empty set, and resolving it now would
        // poison the gate for the transient `friends=[]` render that precedes
        // the real list (suppressing the skeletons when the friends arrive).
        return;
      }
      const token = ++currentTokenRef.current;
      // Bounded wait: if this app run's first live sync is slow, release the
      // gate after a few seconds and fall back to painting the cached snapshot
      // (the pre-gate behavior) rather than holding skeletons over data we
      // already have. The timeout deliberately does NOT mark the run synced;
      // only a settled fetch does.
      let timeoutID: ReturnType<typeof setTimeout> | undefined;
      if (!hasSyncedThisAppRun()) {
        timeoutID = setTimeout(() => {
          if (token === currentTokenRef.current) {
            setHasResolvedInitial(true);
          }
        }, CONST.TIMING.FRIENDS_COLD_SYNC_TIMEOUT);
      }
      Profile.fetchUsersData(friendIDs)
        .finally(() => {
          // Settling (success OR failure) marks the run synced: a failed fetch
          // must degrade to the cached list, not re-gate every later mount
          // while the API is down. Data still self-heals via the on-focus and
          // reconnect refreshes.
          markSyncedThisAppRun();
          if (token === currentTokenRef.current) {
            setHasResolvedInitial(true);
          }
        })
        // Non-2xx reads reject (see the API error pipeline); the gate is
        // already released in `finally`, so swallow to avoid an unhandled
        // rejection.
        .catch(() => undefined);
      return () => {
        if (timeoutID !== undefined) {
          clearTimeout(timeoutID);
        }
      };
    }, [friendIDs]),
  );

  return {profileList, userStatusList, isLoading};
}

export default useFriendsData;
