// DatabaseDataContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useContext, useEffect, useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import type {
  Config,
  UnconfirmedDays,
  UserData,
  UserStatus,
} from '@src/types/onyx';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import useListenToData from '@hooks/useListenToData';
import setCrashReportingCollectionEnabled from '@libs/setCrashReportingCollectionEnabled';
import ONYXKEYS from '@src/ONYXKEYS';
import {useFirebase} from './FirebaseContext';

type DatabaseDataContextType = {
  userStatusData?: UserStatus;
  unconfirmedDays?: UnconfirmedDays;
  userData?: UserData;
  /** Global app configuration, including the terms re-consent signal. */
  config?: Config;
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

  const dataTypes: FetchDataKeys = [
    'config',
    'userStatusData',
    'unconfirmedDays',
    'userData',
  ];

  const {data, isFetchingOlderMonths} = useListenToData(dataTypes, userID);

  const [preferences] = useOnyx(ONYXKEYS.PREFERENCES);

  const value = useMemo(
    () => ({
      userStatusData: data.userStatusData,
      unconfirmedDays: data.unconfirmedDays,
      userData: data.userData,
      config: data.config,
      isFetchingOlderMonths,
    }),
    [data, isFetchingOlderMonths],
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

  // Monitor local data for changes - TODO rewrite this later
  // useEffect(() => {
  //   Object.entries(data).forEach(([key, value]) => {
  //     if (key === 'userData') {
  //       Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
  //         [userID]: value as UserData,
  //       });
  //     }
  //   });
  // }, [data.userData]);

  return (
    <DatabaseDataContext.Provider value={value}>
      {children}
    </DatabaseDataContext.Provider>
  );
}

export {DatabaseDataContext, useDatabaseData, DatabaseDataProvider};
