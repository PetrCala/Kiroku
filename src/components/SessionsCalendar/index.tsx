import React, {memo, useCallback, useMemo} from 'react';
import type {DateData} from 'react-native-calendars';
import {differenceInMonths, format} from 'date-fns';
import {getPreviousMonth, getNextMonth} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import {useFirebase} from '@context/global/FirebaseContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {DateString, Timestamp} from '@src/types/onyx/OnyxCommon';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import SessionsCalendarView from './SessionsCalendarView';
import type SessionsCalendarProps from './types';

function SessionsCalendar({
  userID,
  visibleDate,
  onDateChange,
  drinkingSessionData,
  preferences,
  isFetchingOlderMonths,
}: SessionsCalendarProps) {
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const {markedDates, unitsMap, loadedFrom, loadMoreMonths, isLoading} =
    useLazyMarkedDates(userID, drinkingSessionData ?? {}, preferences);
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  // Persisted floor for the viewed user — the canonical "started tracking on"
  // boundary. Falls back to the in-memory derivation when undefined, which
  // covers the brief window before the one-time backfill writes the field.
  const persistedEarliest: Timestamp | undefined =
    userDataList?.[userID]?.earliest_session_at;

  const minDate = useMemo(() => {
    const trackingStart =
      persistedEarliest !== undefined
        ? new Date(persistedEarliest)
        : DSUtils.getUserTrackingStartDate(drinkingSessionData);
    if (!trackingStart) {
      return CONST.DATE.MIN_DATE;
    }
    return format(trackingStart, CONST.DATE.CALENDAR_FORMAT);
  }, [drinkingSessionData, persistedEarliest]);

  const handleLeftArrowPress = (subtractMonth: () => void) => {
    const monthsAway = differenceInMonths(
      new Date(visibleDate.timestamp),
      new Date(loadedFrom?.current ?? new Date()),
    );
    if (monthsAway <= 1) {
      loadMoreMonths(1);
    }

    const previousMonth = getPreviousMonth(visibleDate);
    onDateChange(previousMonth);

    subtractMonth();
  };

  const handleRightArrowPress = (addMonth: () => void) => {
    const nextMonth = getNextMonth(visibleDate);
    onDateChange(nextMonth);
    addMonth();
  };

  const onDayPress = useCallback(
    (dateData: DateData) => {
      if (userID !== user?.uid) {
        return;
      }
      Navigation.navigate(
        ROUTES.DAY_OVERVIEW.getRoute(dateData.dateString as DateString),
      );
      // TODO display other user's sessions too in a clever manner
    },
    [userID, user?.uid],
  );

  if (isLoading) {
    return <FlexibleLoadingIndicator />;
  }

  return (
    <SessionsCalendarView
      markedDates={markedDates}
      unitsMap={unitsMap}
      visibleDate={visibleDate}
      minDate={minDate}
      onDayPress={onDayPress}
      onLeftArrowPress={handleLeftArrowPress}
      onRightArrowPress={handleRightArrowPress}
      isFetchingOlderMonths={isFetchingOlderMonths}
    />
  );
}

SessionsCalendar.displayName = 'SessionsCalendar';
export default memo(SessionsCalendar);
