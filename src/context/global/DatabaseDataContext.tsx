// DatabaseDataContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useContext, useEffect, useMemo} from 'react';
import Onyx from 'react-native-onyx';
import type {
  DrinkingSessionList,
  Preferences,
  UnconfirmedDays,
  UserData,
  UserStatus,
} from '@src/types/onyx';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import useListenToData from '@hooks/useListenToData';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import {useFirebase} from './FirebaseContext';

type DatabaseDataContextType = {
  userStatusData?: UserStatus;
  drinkingSessionData?: DrinkingSessionList;
  preferences?: Preferences;
  unconfirmedDays?: UnconfirmedDays;
  userData?: UserData;
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
    'userStatusData',
    'drinkingSessionData',
    'preferences',
    'unconfirmedDays',
    'userData',
  ];

  // The listener is the single source of truth for the auth user. Its React
  // state delivers all fields synchronously as Firebase responds. We also
  // write-through to per-user Onyx collections from inside the listener (see
  // `useListenToData`) so friend-profile revisits and other-user views can
  // render from cache via `usePreferencesFetch` / `useUserDataFetch`. The
  // auth user's own render path stays on React state — adding a second
  // Onyx-backed source for the same data only creates hydration races.
  const {data} = useListenToData(dataTypes, userID);

  const value = useMemo(
    () => ({
      userStatusData: data.userStatusData,
      drinkingSessionData: data.drinkingSessionData,
      preferences: data.preferences,
      unconfirmedDays: data.unconfirmedDays,
      userData: data.userData,
    }),
    [data],
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
  }, [data.preferences]);

  return (
    <DatabaseDataContext.Provider value={value}>
      {children}
    </DatabaseDataContext.Provider>
  );
}

export {DatabaseDataContext, useDatabaseData, DatabaseDataProvider};
