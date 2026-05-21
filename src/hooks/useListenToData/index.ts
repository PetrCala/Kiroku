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
import {subMonths} from 'date-fns';
import {orderByChild, query, ref, startAt} from 'firebase/database';
import {useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';

/* eslint-disable react-compiler/react-compiler */

// Define a type for the hook's return value
type UseListenToDataReturn = {
  data: FetchData;
};

const DRINKING_SESSIONS_KEY: FetchDataKey = 'drinkingSessionData';

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
 * `SESSIONS_CALENDAR_MONTHS_LOADED` via [[useLazyMarkedDates]]).
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
  const [data, setData] = useState<Partial<Record<FetchDataKey, unknown>>>({});
  const [monthsLoaded] = useOnyx(ONYXKEYS.SESSIONS_CALENDAR_MONTHS_LOADED);

  // Months of session history to subscribe to. Keeps the fetch window at least
  // as wide as the user's saved calendar scroll depth so cold-start coverage
  // matches what the calendar will render.
  const sessionsMonthsBack = Math.max(
    CONST.SESSIONS_INITIAL_FETCH_MONTHS,
    monthsLoaded ?? 0,
  );

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
      setData(prevData => ({
        ...prevData,
        [DRINKING_SESSIONS_KEY]: fetchedData,
      }));
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userID, sessionsMonthsBack]);

  return {
    data: data as FetchData,
  };
};

export default useListenToData;
