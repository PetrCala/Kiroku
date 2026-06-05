// DatabaseDataContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useContext, useEffect, useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import useListenToData from '@hooks/useListenToData';
import setCrashReportingCollectionEnabled from '@libs/setCrashReportingCollectionEnabled';
import ONYXKEYS from '@src/ONYXKEYS';
import {useFirebase} from './FirebaseContext';

type DatabaseDataContextType = {
  /** Legacy windowed-listener flag. Always `false` now that the signed-in
   *  user's sessions are read in full from Onyx `cachedDrinkingSessions`
   *  (the Firebase session listener was removed); kept until the calendar's
   *  older-months loading UI is cleaned up. */
  isFetchingOlderMonths: boolean;
};

const DatabaseDataContext = createContext<DatabaseDataContextType | undefined>(
  undefined,
);

const useDatabaseData = (): DatabaseDataContextType => {
  const context = useContext(DatabaseDataContext);
  if (!context) {
    throw new Error(
      'useDatabaseData must be used within a DatabaseDataProvider',
    );
  }
  return context;
};

type DatabaseDataProviderProps = {
  children: ReactNode;
};

function DatabaseDataProvider({children}: DatabaseDataProviderProps) {
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const userID = user ? user.uid : '';

  // Every realtime read has migrated off the Firebase listener to Onyx
  // (hydrated via `app/open` + kiroku-api updates), so no node keys remain. The
  // `useListenToData` / `useFetchData` / `baseFunctions` listener infra is now
  // dead and slated for the #809 final-teardown follow-up. `isFetchingOlderMonths`
  // is retained until the calendar's older-months loading UI is cleaned up.
  const dataTypes: FetchDataKeys = [];

  const {isFetchingOlderMonths} = useListenToData(dataTypes, userID);

  const [preferences] = useOnyx(ONYXKEYS.PREFERENCES);

  const value = useMemo(
    () => ({
      isFetchingOlderMonths,
    }),
    [isFetchingOlderMonths],
  );

  // Apply the crash-reporting opt-out from the user's preferences (server is the
  // source of truth via `app/open`, so it survives reinstall) to the native
  // collectors. Absent ⇒ enabled (the legitimate-interest opt-out default);
  // gating against the build flag and the web no-op live in the util.
  // Crashlytics persists this across restarts.
  useEffect(() => {
    if (preferences === undefined) {
      return;
    }
    setCrashReportingCollectionEnabled(
      preferences.crash_reporting_enabled !== false,
    );
  }, [preferences]);

  return (
    <DatabaseDataContext.Provider value={value}>
      {children}
    </DatabaseDataContext.Provider>
  );
}

export {DatabaseDataContext, useDatabaseData, DatabaseDataProvider};
