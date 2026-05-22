import {useFirebase} from '@context/global/FirebaseContext';
import {
  listenForDataChanges,
  listenForQueryChanges,
} from '@database/baseFunctions';
import type {
  FetchData,
  FetchDataKey,
  FetchDataKeys,
} from '@hooks/useFetchData/types';
import {fetchDataKeyToDbPath} from '@hooks/useFetchData/utils';
import useLocalize from '@hooks/useLocalize';
import * as App from '@userActions/App';
import * as DrinkingSession from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionList} from '@src/types/onyx';
import {startOfMonth, subMonths} from 'date-fns';
import {orderByChild, query, ref, startAt} from 'firebase/database';
import {useEffect, useRef, useState} from 'react';
import Onyx, {useOnyx} from 'react-native-onyx';

/* eslint-disable react-compiler/react-compiler */

// Define a type for the hook's return value
type UseListenToDataReturn = {
  data: FetchData;
  /** True while a wider-window resubscribe for `drinkingSessionData` is in
   *  flight (user scrolled the calendar past the loaded edge). Cleared on the
   *  first listener callback after the widen. Stays false during the initial
   *  subscription and during incremental live updates within the same window. */
  isFetchingOlderMonths: boolean;
};

const DRINKING_SESSIONS_KEY: FetchDataKey = 'drinkingSessionData';

// A user with no sessions still needs a non-undefined value so consumers can
// distinguish "loaded but empty" from "still loading". Empty object is
// preserved by reference so memoized derivations don't churn.
const EMPTY_SESSIONS: DrinkingSessionList = {};

/**
 * Custom hook to listen to data in the database.
 *
 * Allows to listen to user's data only in the relevant database nodes. Does not attach
 * listeners for the unused keys.
 *
 * The `drinkingSessionData` listener uses a server-side `start_time` window
 * snapped to month boundaries: the cold load streams from the start of the
 * earliest visible month (default ~3 months back) through today, so any
 * month inside the window is fetched in full and the calendar can't
 * misrender a partial-month range as "before tracking started". The window
 * widens automatically when the user scrolls the calendar past the loaded
 * edge (which bumps `SESSIONS_CALENDAR_MONTHS_BY_USER_ID` via
 * [[useLazyMarkedDates]]).
 *
 * @param userID User to listen to the data for
 * @param dataTypes Database node keys to listen to data for
 * @returns An object with the data
 * @example
 * const {data} = useListenToData(userID, ['userStatusData', 'drinkingSessionData']);
 */
const useListenToData = (
  dataTypes: FetchDataKeys,
  userID?: string,
): UseListenToDataReturn => {
  const {db} = useFirebase();
  const {translate} = useLocalize();
  const [cachedSessionsByUser] = useOnyx(ONYXKEYS.CACHED_DRINKING_SESSIONS);
  const cachedSessions: DrinkingSessionList | null | undefined =
    userID && cachedSessionsByUser ? cachedSessionsByUser[userID] : undefined;
  const [userDataList, userDataListMeta] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const [monthsLoaded, monthsLoadedMeta] = useOnyx(
    // `userID` may be empty during the auth-resolving window; the suffix is
    // tolerated by Onyx and the effect below gates on its loaded status.
    `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID ?? ''}`,
  );

  // Months of session history to subscribe to. Keeps the fetch window at least
  // as wide as the user's saved calendar scroll depth so cold-start coverage
  // matches what the calendar will render.
  const sessionsMonthsBack = Math.max(
    CONST.SESSIONS_INITIAL_FETCH_MONTHS,
    monthsLoaded ?? 0,
  );

  const [data, setData] = useState<Partial<Record<FetchDataKey, unknown>>>(
    () => {
      if (!dataTypes.includes(DRINKING_SESSIONS_KEY)) {
        return {};
      }
      // null cache means "previously loaded, user has no sessions" — seed with
      // an empty object so the calendar can render immediately. undefined
      // cache means "never observed" — leave the key absent so consumers can
      // show a loading state until Firebase responds.
      if (cachedSessions === null) {
        return {[DRINKING_SESSIONS_KEY]: EMPTY_SESSIONS};
      }
      if (cachedSessions) {
        return {[DRINKING_SESSIONS_KEY]: cachedSessions};
      }
      return {};
    },
  );

  // Tracks whether a widen (sessionsMonthsBack increase) is currently waiting
  // on its first listener callback. Held in a ref so the listener closure can
  // read+clear it without re-subscribing.
  const [isFetchingOlderMonths, setIsFetchingOlderMonths] = useState(false);
  const prevSessionsMonthsBackRef = useRef<number | null>(null);
  const pendingWidenRef = useRef(false);
  // Tracks the userID the widen-state refs above belong to, so we can reset
  // them when the active user changes (their saved depth is independent).
  const widenTrackedUserIDRef = useRef<string | undefined>(userID);

  // Reset session data during render when the active user changes so the
  // previous user's data never bleeds across an account switch. Seeds with the
  // new user's cached snapshot if one exists. See
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevUserID, setPrevUserID] = useState(userID);
  if (prevUserID !== userID) {
    setPrevUserID(userID);
    if (isFetchingOlderMonths) {
      // The new user's first subscription is an initial fetch, not a widen.
      setIsFetchingOlderMonths(false);
    }
    if (dataTypes.includes(DRINKING_SESSIONS_KEY)) {
      const seed =
        cachedSessions === null ? EMPTY_SESSIONS : cachedSessions ?? undefined;
      setData(prevData => ({
        ...prevData,
        [DRINKING_SESSIONS_KEY]: seed,
      }));
    }
  }

  useEffect(() => {
    if (!db) {
      App.setLoadingText(null);
      return;
    }

    App.setLoadingText(translate('database.loading'));

    const unsubscribers = dataTypes
      .filter(key => key !== DRINKING_SESSIONS_KEY)
      .map(dataTypeKey => {
        const path = fetchDataKeyToDbPath(dataTypeKey, userID);

        if (path) {
          return listenForDataChanges(db, path, fetchedData => {
            setData(prevData => ({
              ...prevData,
              [dataTypeKey]: fetchedData,
            }));
          });
        }
        return () => {};
      });

    App.setLoadingText(null);

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userID, translate]);

  useEffect(() => {
    if (!db || !dataTypes.includes(DRINKING_SESSIONS_KEY)) {
      return;
    }
    // Wait for Onyx to hydrate so we don't subscribe with the default 3-month
    // window and then immediately resubscribe with the saved wider value.
    if (monthsLoadedMeta.status !== 'loaded') {
      return;
    }
    const path = fetchDataKeyToDbPath(DRINKING_SESSIONS_KEY, userID);
    if (!path) {
      return;
    }

    if (widenTrackedUserIDRef.current !== userID) {
      // userID changed — the saved depth for the new user is independent of
      // the previous user's. Drop prior widen-tracking before comparing.
      widenTrackedUserIDRef.current = userID;
      prevSessionsMonthsBackRef.current = null;
      pendingWidenRef.current = false;
    }
    const prev = prevSessionsMonthsBackRef.current;
    if (prev !== null && sessionsMonthsBack > prev) {
      // Widen detected — mark in-flight until the new subscription fires.
      pendingWidenRef.current = true;
      setIsFetchingOlderMonths(true);
    }
    prevSessionsMonthsBackRef.current = sessionsMonthsBack;

    // Snap to the start of the earliest visible month so every month inside
    // the fetched window is loaded in full — without this, viewing a past
    // month while the sliding window stops mid-month would leave the early
    // days unfetched and misrender them as "before tracking started".
    const startAtMillis = startOfMonth(
      subMonths(new Date(), sessionsMonthsBack),
    ).getTime();
    const sessionsQuery = query(
      ref(db, path),
      orderByChild('start_time'),
      startAt(startAtMillis),
    );

    const unsubscribe = listenForQueryChanges(sessionsQuery, fetchedData => {
      const sessions = (fetchedData ?? EMPTY_SESSIONS) as DrinkingSessionList;
      setData(prevData => ({
        ...prevData,
        [DRINKING_SESSIONS_KEY]: sessions,
      }));
      if (pendingWidenRef.current) {
        pendingWidenRef.current = false;
        setIsFetchingOlderMonths(false);
      }

      if (userID) {
        // Persist authoritative live data so the next cold launch can render
        // before the listener resolves. Firebase stays the source of truth.
        // null marks "loaded but empty" so the next launch can render the
        // empty calendar without waiting on Firebase.
        // eslint-disable-next-line rulesdir/prefer-actions-set-data
        Onyx.merge(ONYXKEYS.CACHED_DRINKING_SESSIONS, {
          [userID]: (fetchedData ?? null) as DrinkingSessionList | null,
        });
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userID, sessionsMonthsBack, monthsLoadedMeta.status]);

  // One-time backfill for `earliest_session_at` on the user record. Legacy
  // accounts (and any user record predating this field) won't have it set,
  // so the first time we observe the user's data with the field missing and
  // sessions present we run a single indexed query to compute and persist
  // the floor. Guarded by a ref so it fires at most once per mount per user.
  const earliestBackfillFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !db ||
      !userID ||
      userDataListMeta.status !== 'loaded' ||
      earliestBackfillFiredForRef.current === userID
    ) {
      return;
    }
    const userData = userDataList?.[userID];
    if (!userData || userData.earliest_session_at !== undefined) {
      return;
    }
    const sessions = data[DRINKING_SESSIONS_KEY] as
      | DrinkingSessionList
      | undefined;
    if (!sessions || Object.keys(sessions).length === 0) {
      return;
    }
    earliestBackfillFiredForRef.current = userID;
    // Fire-and-forget; failures are non-fatal and the next write will repair.
    DrinkingSession.recomputeEarliestSessionAt(db, userID).catch(() => {
      // Allow a later effect cycle to retry if conditions still hold.
      earliestBackfillFiredForRef.current = null;
    });
  }, [db, userID, userDataList, userDataListMeta.status, data]);

  return {
    data: data as FetchData,
    isFetchingOlderMonths,
  };
};

export default useListenToData;
