// DatabaseDataContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useContext, useEffect, useMemo} from 'react';
import Onyx, {useOnyx} from 'react-native-onyx';
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

  // The listener still subscribes for *all* keys (so write-through fires for
  // preferences/userData), but we read those two from Onyx via `useOnyx`
  // below — they're cached per-user. The listener's React state is the
  // primary source for the remaining keys.
  const {data} = useListenToData(dataTypes, userID);

  const [preferencesFromOnyx] = useOnyx(
    `${ONYXKEYS.COLLECTION.PREFERENCES}${userID}`,
  );
  const [userDataFromOnyx] = useOnyx(
    `${ONYXKEYS.COLLECTION.USER_DATA}${userID}`,
  );

  const value = useMemo(
    () => ({
      userStatusData: data.userStatusData,
      drinkingSessionData: data.drinkingSessionData,
      preferences: preferencesFromOnyx ?? undefined,
      unconfirmedDays: data.unconfirmedDays,
      userData: userDataFromOnyx ?? undefined,
    }),
    [data, preferencesFromOnyx, userDataFromOnyx],
  );

  // Sync theme preference from Firebase to Onyx when preferences are loaded
  // This ensures the app theme is consistent with the user's saved preference
  useEffect(() => {
    if (!preferencesFromOnyx) {
      return;
    }
    const theme = preferencesFromOnyx.theme ?? CONST.THEME.DEFAULT;
    // eslint-disable-next-line rulesdir/prefer-actions-set-data
    Onyx.set(ONYXKEYS.PREFERRED_THEME, theme);
  }, [preferencesFromOnyx]);

  return (
    <DatabaseDataContext.Provider value={value}>
      {children}
    </DatabaseDataContext.Provider>
  );
}

export {DatabaseDataContext, useDatabaseData, DatabaseDataProvider};
