// DatabaseDataContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useContext, useEffect, useMemo} from 'react';
import Onyx from 'react-native-onyx';
import type {
  Config,
  DataVisibility,
  Preferences,
  UnconfirmedDays,
  UserData,
  UserStatus,
} from '@src/types/onyx';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import useListenToData from '@hooks/useListenToData';
import setCrashReportingCollectionEnabled from '@libs/setCrashReportingCollectionEnabled';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import {useFirebase} from './FirebaseContext';

type DatabaseDataContextType = {
  userStatusData?: UserStatus;
  preferences?: Preferences;
  unconfirmedDays?: UnconfirmedDays;
  userData?: UserData;
  /** Owner-controlled visibility of the current user's drinking data to
   *  friends. Absent ⇒ fully visible (grandfathered default). */
  dataVisibility?: DataVisibility;
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
    'preferences',
    'unconfirmedDays',
    'userData',
    'dataVisibility',
  ];

  const {data, isFetchingOlderMonths} = useListenToData(dataTypes, userID);

  const value = useMemo(
    () => ({
      userStatusData: data.userStatusData,
      preferences: data.preferences,
      unconfirmedDays: data.unconfirmedDays,
      userData: data.userData,
      dataVisibility: data.dataVisibility,
      config: data.config,
      isFetchingOlderMonths,
    }),
    [data, isFetchingOlderMonths],
  );

  // Sync theme preference from Firebase to Onyx when preferences are loaded
  // This ensures the app theme is consistent with the user's saved preference
  useEffect(() => {
    if (data.preferences === undefined) {
      return;
    }
    const theme = data.preferences?.theme ?? CONST.THEME.DEFAULT;
    // eslint-disable-next-line rulesdir/prefer-actions-set-data
    Onyx.set(ONYXKEYS.PREFERRED_THEME, theme);
    // Apply the crash-reporting opt-out from Firebase (source of truth, so it
    // survives reinstall) to the native collectors. Absent ⇒ enabled (the
    // legitimate-interest opt-out default); gating against the build flag and
    // the web no-op live in the util. Crashlytics persists this across restarts.
    setCrashReportingCollectionEnabled(
      data.preferences?.crash_reporting_enabled !== false,
    );
  }, [data.preferences]);

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
