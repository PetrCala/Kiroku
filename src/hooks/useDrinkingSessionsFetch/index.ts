import {useFirebase} from '@context/global/FirebaseContext';
import {fetchDataKeyToDbPath} from '@hooks/useFetchData/utils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionList} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {startOfMonth, subMonths} from 'date-fns';
import {get, orderByChild, query, ref, startAt} from 'firebase/database';
import {useEffect, useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';

type UseDrinkingSessionsFetchReturn = {
  /** Last-good snapshot of the windowed session list. Stays populated across
   *  widen re-fetches so the calendar doesn't blank out during the round trip. */
  data: DrinkingSessionList | undefined;
  /** True only on the initial fetch — later widens swap `data` on resolve
   *  without flipping this back to true. Consumers should NOT show a full
   *  loading state on widens. */
  isLoading: boolean;
  /** True while a wider-window re-fetch is in flight (user scrolled the
   *  calendar past the loaded edge). Cleared when the new `get()` resolves. */
  isFetchingOlderMonths: boolean;
};

/**
 * One-shot Firebase `get()` for a target user's drinking sessions, windowed
 * server-side by `start_time` to the most recent
 * `CONST.SESSIONS_INITIAL_FETCH_MONTHS` months (or wider if the user has
 * scrolled the calendar back, persisted per-UID in
 * `${COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID}`).
 *
 * Used by the friend-profile screen so opening a profile with thousands of
 * sessions doesn't download the entire collection. When the calendar widens
 * (via [[useLazyMarkedDates.loadMoreMonths]]) the Onyx entry bumps and this
 * hook fires a new `get()` with an earlier `startAt`. Stale in-flight
 * responses are dropped via a request token.
 */
function useDrinkingSessionsFetch(
  userID: UserID,
): UseDrinkingSessionsFetchReturn {
  const {db} = useFirebase();
  const [monthsLoaded, monthsLoadedMeta] = useOnyx(
    `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID}`,
  );

  const [data, setData] = useState<DrinkingSessionList | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetchingOlderMonths, setIsFetchingOlderMonths] =
    useState<boolean>(false);
  const prevSessionsMonthsBackRef = useRef<number | null>(null);

  // Latest-wins request token. Bumped before each fetch; on resolve we ignore
  // the response unless its token still matches `currentTokenRef.current`.
  // Prevents stale wider/narrower responses from clobbering a newer fetch.
  const currentTokenRef = useRef(0);
  const hasResolvedInitialRef = useRef(false);

  const sessionsMonthsBack = Math.max(
    CONST.SESSIONS_INITIAL_FETCH_MONTHS,
    monthsLoaded ?? 0,
  );

  useEffect(() => {
    // Skip until prerequisites are in place. `isLoading` stays `true` —
    // ProfileScreen mounts after auth so `db` and `userID` are always set in
    // practice, and Onyx hydration is fast.
    if (
      !db ||
      !userID ||
      // Wait for Onyx to hydrate so we don't fetch the default 3 months and
      // then immediately re-fetch when the saved wider depth arrives.
      monthsLoadedMeta.status !== 'loaded'
    ) {
      return;
    }

    const path = fetchDataKeyToDbPath('drinkingSessionData', userID);
    if (!path) {
      return;
    }

    const token = ++currentTokenRef.current;
    const prev = prevSessionsMonthsBackRef.current;
    const isWiden = prev !== null && sessionsMonthsBack > prev;
    prevSessionsMonthsBackRef.current = sessionsMonthsBack;
    if (isWiden) {
      setIsFetchingOlderMonths(true);
    }
    // Snap to the start of the earliest visible month — see useListenToData
    // for the matching change; both fetchers must agree so the calendar's
    // partial-month rendering bug is fixed on home and friend profiles alike.
    const startAtMillis = startOfMonth(
      subMonths(new Date(), sessionsMonthsBack),
    ).getTime();
    const sessionsQuery = query(
      ref(db, path),
      orderByChild('start_time'),
      startAt(startAtMillis),
    );

    const finalize = (next: DrinkingSessionList | undefined) => {
      if (token !== currentTokenRef.current) {
        return;
      }
      if (next !== undefined) {
        setData(next);
      } else if (!hasResolvedInitialRef.current) {
        // First resolve with no sessions — clear any stale state.
        setData(undefined);
      }
      if (!hasResolvedInitialRef.current) {
        hasResolvedInitialRef.current = true;
        setIsLoading(false);
      }
      setIsFetchingOlderMonths(false);
    };

    get(sessionsQuery)
      .then(snapshot => {
        finalize(
          snapshot.exists()
            ? (snapshot.val() as DrinkingSessionList)
            : undefined,
        );
      })
      .catch(() => finalize(undefined));
  }, [db, userID, sessionsMonthsBack, monthsLoadedMeta.status]);

  return {data, isLoading, isFetchingOlderMonths};
}

export default useDrinkingSessionsFetch;
