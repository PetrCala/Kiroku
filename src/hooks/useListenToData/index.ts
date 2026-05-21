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
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionList} from '@src/types/onyx';
import {subMonths} from 'date-fns';
import {orderByChild, query, ref, startAt} from 'firebase/database';
import {useEffect, useState} from 'react';
import Onyx, {useOnyx} from 'react-native-onyx';

/* eslint-disable react-compiler/react-compiler */

// Define a type for the hook's return value
type UseListenToDataReturn = {
  data: FetchData;
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
 * The `drinkingSessionData` listener uses a server-side `start_time` window so
 * the initial cold load only streams the most recent ~3 months of sessions
 * instead of the full collection. The window widens automatically when the
 * user scrolls the calendar past the loaded edge (which bumps
 * `SESSIONS_CALENDAR_MONTHS_BY_USER_ID` via [[useLazyMarkedDates]]).
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

  // Reset session data during render when the active user changes so the
  // previous user's data never bleeds across an account switch. Seeds with the
  // new user's cached snapshot if one exists. See
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevUserID, setPrevUserID] = useState(userID);
  if (prevUserID !== userID) {
    setPrevUserID(userID);
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

    const startAtMillis = subMonths(new Date(), sessionsMonthsBack).getTime();
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

  return {
    data: data as FetchData,
  };
};

export default useListenToData;
