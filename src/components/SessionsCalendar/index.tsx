import React, {memo, useCallback, useEffect, useState} from 'react';
import type {DateData} from 'react-native-calendars';
import {differenceInMonths, format} from 'date-fns';
import {getPreviousMonth, getNextMonth} from '@libs/DataHandling';
import type {DrinkingSessionList} from '@src/types/onyx';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import {useFirebase} from '@context/global/FirebaseContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import SessionsCalendarView from './SessionsCalendarView';
import type SessionsCalendarProps from './types';

function SessionsCalendar({
  userID,
  visibleDate,
  onDateChange,
  drinkingSessionData,
  preferences,
}: SessionsCalendarProps) {
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const {markedDates, unitsMap, loadedFrom, loadMoreMonths, isLoading} =
    useLazyMarkedDates(userID, drinkingSessionData ?? {}, preferences);
  const [minDate, setMinDate] = useState<string>(CONST.DATE.MIN_DATE);

  const calculateMinDate = (
    data: DrinkingSessionList | null | undefined,
  ): string => {
    const trackingStartDate = DSUtils.getUserTrackingStartDate(data);

    if (!trackingStartDate) {
      return CONST.DATE.MIN_DATE;
    }
    return format(trackingStartDate, CONST.DATE.CALENDAR_FORMAT);
  };

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

  useEffect(() => {
    setMinDate(calculateMinDate(drinkingSessionData));
  }, [drinkingSessionData]);

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
    />
  );
}

SessionsCalendar.displayName = 'SessionsCalendar';
export default memo(SessionsCalendar);
