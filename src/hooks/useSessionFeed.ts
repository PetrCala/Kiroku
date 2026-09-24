import {useCallback, useMemo, useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import {getOldestStartTime, sortSessionsNewestFirst} from '@libs/SessionFeed';
import * as SessionWindow from '@libs/SessionWindow';
import fetchSessionsPage from '@userActions/SessionFeed';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';

type SessionFeedState = {
  /** The user's loaded sessions, newest first. */
  items: DrinkingSessionKeyValue[];

  /** Whether an older page may exist. `false` once the history is exhausted. */
  hasMore: boolean;

  /** True while a page is being fetched. */
  isLoadingMore: boolean;

  /** Fetch the next older page. A no-op while one is in flight or at the end. */
  loadMore: () => void;
};

/**
 * The Home feed's list and its pagination (RFC §10).
 *
 * The list is derived from `cachedDrinkingSessions[userID]`, the one map every
 * session read fills (the app-open snapshot, the calendar's month windows, the
 * feed's own pages), so a session added, edited or deleted anywhere shows up
 * here without the feed holding a copy. Only the pagination state is local: the
 * cursor is simply the oldest loaded session (see `getOldestStartTime`), and
 * the end of the history is remembered as the cursor the server answered
 * "nothing older" for. If the map later shrinks (a full re-baseline replaces
 * it with the boot window), the oldest loaded session moves and paging resumes
 * from there by itself.
 *
 * The user's `earliest_session_at` (the persisted floor, written for the
 * signed-in user only) ends paging without a round trip once the oldest loaded
 * session reaches it.
 */
function useSessionFeed(userID: UserID | undefined): SessionFeedState {
  const [cachedByUser] = useOnyx(ONYXKEYS.CACHED_DRINKING_SESSIONS);
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const sessions = userID ? cachedByUser?.[userID] : undefined;
  const earliestSessionAt = userID
    ? userDataList?.[userID]?.earliest_session_at
    : undefined;

  const items = useMemo(() => sortSessionsNewestFirst(sessions), [sessions]);
  const oldestLoaded = getOldestStartTime(items);

  // The cursor the server last said had nothing older than it, for which
  // user. Compared by value: if the oldest loaded session changes, or the
  // user does, the answer no longer applies. Tagging both states with the
  // user (instead of resetting them in an effect) means a switch of user is
  // correct in the same render.
  const [endedAt, setEndedAt] = useState<{
    userID: UserID;
    cursor: number | undefined;
  } | null>(null);
  const [loading, setLoading] = useState<{userID: UserID} | null>(null);
  const isLoadingMore = !!userID && loading?.userID === userID;
  // Latest-wins: only the page in flight may clear the loading state.
  const requestTokenRef = useRef(0);

  const reachedFloor =
    earliestSessionAt !== undefined &&
    oldestLoaded !== undefined &&
    oldestLoaded <= earliestSessionAt;
  const hasMore =
    !!userID &&
    sessions !== undefined &&
    !reachedFloor &&
    !(
      endedAt !== null &&
      endedAt.userID === userID &&
      endedAt.cursor === oldestLoaded
    );

  const loadMore = useCallback(() => {
    if (!userID || !hasMore || isLoadingMore) {
      return;
    }
    const token = ++requestTokenRef.current;
    const cursor = oldestLoaded;
    setLoading({userID});
    fetchSessionsPage(userID, cursor)
      .then(page => {
        if (!page) {
          return;
        }
        if (page.nextCursor === null) {
          setEndedAt({userID, cursor});
        }
        // The map now reaches down to the page's oldest session, or to the
        // start of the history: a re-baseline must not drop that again.
        SessionWindow.noteLoadedBackTo(
          userID,
          page.nextCursor ?? earliestSessionAt ?? 0,
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (token === requestTokenRef.current) {
          setLoading(null);
        }
      });
  }, [userID, hasMore, isLoadingMore, oldestLoaded, earliestSessionAt]);

  return {items, hasMore, isLoadingMore, loadMore};
}

export default useSessionFeed;
export type {SessionFeedState};
