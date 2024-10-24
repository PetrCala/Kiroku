﻿// DatabaseDataContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useContext, useMemo} from 'react';
import {useFirebase} from './FirebaseContext';
import type {
  DrinkingSessionList,
  Preferences,
  UnconfirmedDays,
  UserProps,
  UserStatus,
} from '@src/types/onyx';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import useListenToData from '@hooks/useListenToData';

type DatabaseDataContextType = {
  userStatusData?: UserStatus;
  drinkingSessionData?: DrinkingSessionList;
  preferences?: Preferences;
  unconfirmedDays?: UnconfirmedDays;
  userData?: UserProps;
  isLoading: boolean;
};

export const DatabaseDataContext = createContext<
  DatabaseDataContextType | undefined
>(undefined);

export const useDatabaseData = (): DatabaseDataContextType => {
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

export const DatabaseDataProvider: React.FC<DatabaseDataProviderProps> = ({
  children,
}) => {
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

  const {data, isLoading} = useListenToData(userID, dataTypes);

  const value = useMemo(
    () => ({
      userStatusData: data.userStatusData,
      drinkingSessionData: data.drinkingSessionData,
      preferences: data.preferences,
      unconfirmedDays: data.unconfirmedDays,
      userData: data.userData,
      isLoading,
    }),
    [data, isLoading],
  );

  return (
    <DatabaseDataContext.Provider value={value}>
      {children}
    </DatabaseDataContext.Provider>
  );
};
