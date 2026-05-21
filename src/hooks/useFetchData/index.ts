import {useEffect, useState} from 'react';
import {subMonths} from 'date-fns';
import {get, orderByChild, query, ref, startAt} from 'firebase/database';
import {readDataOnce} from '@database/baseFunctions'; // Ensure this import is added
import {useFirebase} from '@context/global/FirebaseContext';
import CONST from '@src/CONST';
import type RefetchDatabaseData from '@src/types/utils/RefetchDatabaseData';
import type {FetchData, FetchDataKey, FetchDataKeys} from './types';
import {fetchDataKeyToDbPath} from './utils';

// This module will be deleted in the future, so we don't care about types for now
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// Define a type for the hook's return value
type UseFetchDataReturn = {
  data: FetchData;
  isLoading: boolean;
  refetch: RefetchDatabaseData;
};

/**
 * Custom hook to fetch data from the database.
 *
 * Allows to fetch data for a user only for relevant database nodes. Does not fetch
 * the data for the unused keys. The refetch function can refetch the data, and it
 * does so only for the specified keys.
 *
 * @param userID User to fetch the data for
 * @param dataTypes Database node keys to fetch data for
 * @returns An object with the fetched data and a refetch function
 * @example
 * const {data, isLoading, refetch} = useFetchData(userID, ['userStatusData', 'drinkingSessionData']);
 */
const useFetchData = (
  userID: string,
  dataTypes: FetchDataKeys,
): UseFetchDataReturn => {
  const {db} = useFirebase();
  const [refetchIndex, setRefetchIndex] = useState(0); // Used to trigger refetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<Partial<Record<FetchDataKey, any>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [resolveRefetch, setResolveRefetch] = useState<() => void>(
    () => () => {},
  );
  const [keysToFetch, setKeysToFetch] = useState<FetchDataKeys>(dataTypes);

  const refetch = (keys?: FetchDataKeys): Promise<void> =>
    new Promise<void>(resolve => {
      setResolveRefetch(() => resolve);
      if (keys) {
        setKeysToFetch(keys);
      } else {
        setKeysToFetch(dataTypes); // Reset to default
      }
      setRefetchIndex(prev => prev + 1);
    });

  useEffect(() => {
    if (!userID || !db) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      const promises = keysToFetch.map(async dataType => {
        const path = fetchDataKeyToDbPath(dataType, userID);
        if (!path) {
          return {};
        }
        let fetchedData: unknown = null;
        if (dataType === 'drinkingSessionData') {
          const startAtMillis = subMonths(
            new Date(),
            CONST.SESSIONS_INITIAL_FETCH_MONTHS,
          ).getTime();
          const sessionsQuery = query(
            ref(db, path),
            orderByChild('start_time'),
            startAt(startAtMillis),
          );
          const snapshot = await get(sessionsQuery);
          fetchedData = snapshot.exists() ? snapshot.val() : null;
        } else {
          fetchedData = await readDataOnce(db, path);
        }
        return {[dataType]: fetchedData};
      });

      const results = await Promise.all(promises);
      const newData = results.reduce((acc, currentData) => {
        Object.assign(acc, currentData);
        return acc;
      }, {});

      setData(prevData => {
        // Merge newData with prevData, ensuring only specified keys are updated
        const updatedData = {...prevData};

        for (const key of keysToFetch) {
          if (Object.prototype.hasOwnProperty.call(newData, key)) {
            updatedData[key] = newData[key];
          }
          // If newData does not have the key, prevData[key] remains unchanged
        }

        return updatedData;
      });

      setIsLoading(false);
      resolveRefetch(); // Resolve the promise only after fetching is complete
    };

    fetchData();
  }, [db, userID, refetchIndex, keysToFetch, resolveRefetch]); // No dataTypes, as that would duplicate the refetch

  return {
    data: {
      userStatusData: data.userStatusData,
      drinkingSessionData: data.drinkingSessionData,
      preferences: data.preferences,
      unconfirmedDays: data.unconfirmedDays,
      userData: data.userData,
    },
    isLoading,
    refetch,
  };
};

export default useFetchData;
