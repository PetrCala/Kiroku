import React, {memo, useCallback, useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import type {MarkingTypes} from 'react-native-calendars/src/types';
import type {DateData} from 'react-native-calendars';
import {Calendar} from 'react-native-calendars';
import {getPreviousMonth, getNextMonth} from '@libs/DataHandling';
import type {DrinkingSessionList} from '@src/types/onyx';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import {differenceInMonths, format} from 'date-fns';
import {useFirebase} from '@context/global/FirebaseContext';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import useStyleUtils from '@hooks/useStyleUtils';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import ONYXKEYS from '@src/ONYXKEYS';
import DayComponent from './DayComponent';
import type {Direction} from './CalendarArrow';
import type SessionsCalendarProps from './types';
import type {DayComponentProps} from './types';
import CalendarArrow from './CalendarArrow';
import setCalendarLocale from './setCalendarLocale';

function SessionsCalendar({
  userID,
  visibleDate,
  onDateChange,
  drinkingSessionData,
  preferences,
}: SessionsCalendarProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const [preferredLocale] = useOnyx(ONYXKEYS.NVP_PREFERRED_LOCALE);
  const {markedDates, unitsMap, loadedFrom, loadMoreMonths, isLoading} =
    useLazyMarkedDates(userID, drinkingSessionData ?? {}, preferences);
  const [minDate, setMinDate] = useState<string>(CONST.DATE.MIN_DATE);
  const [locale, setLocale] = useState<string>(CONST.LOCALES.DEFAULT);

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

    subtractMonth(); // Use the callback to move to the previous month
  };

  const handleRightArrowPress = (addMonth: () => void) => {
    const nextMonth = getNextMonth(visibleDate);
    onDateChange(nextMonth);
    addMonth(); // Use the callback to move to the next month
  };

  const dayComponent = useCallback(
    ({date, state, marking, theme}: DayComponentProps) => {
      const onDayPress = (dateData: DateData) => {
        if (userID !== user?.uid) {
          return;
        }
        Navigation.navigate(
          ROUTES.DAY_OVERVIEW.getRoute(dateData.dateString as DateString),
        );
        // TODO display other user's sessions too in a clever manner
      };

      return (
        <DayComponent
          date={date}
          state={state}
          units={date ? unitsMap.get(date.dateString as DateString) : 0}
          marking={marking}
          theme={theme}
          onPress={onDayPress}
        />
      );
    },
    [unitsMap, user?.uid, userID],
  );

  useEffect(() => {
    setMinDate(calculateMinDate(drinkingSessionData));
  }, [drinkingSessionData]);

  useEffect(() => {
    const newLocale = preferredLocale ?? CONST.LOCALES.DEFAULT;
    setCalendarLocale(newLocale);
    setLocale(newLocale);
  }, [preferredLocale]);

  if (isLoading) {
    return <FlexibleLoadingIndicator />;
  }

  return (
    <Calendar
      current={visibleDate.dateString}
      dayComponent={dayComponent}
      minDate={minDate}
      maxDate={format(new Date(), CONST.DATE.CALENDAR_FORMAT)}
      monthFormat={CONST.DATE.MONTH_YEAR_ABBR_FORMAT} // e.g. "Mar 2024"
      onPressArrowLeft={handleLeftArrowPress}
      onPressArrowRight={handleRightArrowPress}
      markedDates={markedDates}
      markingType={'period' as MarkingTypes}
      firstDay={CONST.WEEK_STARTS_ON} // e.g. Monday = 1
      enableSwipeMonths={false}
      disableAllTouchEventsForDisabledDays
      renderArrow={(direction: Direction) => CalendarArrow(direction)}
      style={styles.sessionsCalendarContainer}
      theme={StyleUtils.getSessionsCalendarStyle()}
      locale={locale}
    />
  );
  // {TODO implement this}
  //   {
  //     /* <Calendar
  //         initialDate=""
  //         context={{ date : '' }} // Disable marking of today
  //         markingType="custom"
  //         markedDates={reservedDates}
  //         renderHeader={date => <Text>{moment(new Date(date)).format('YYYY MMMM')}</Text>}
  //         enableSwipeMonths
  // /> */
  //   }
}

SessionsCalendar.displayName = 'SessionsCalendar';
export default memo(SessionsCalendar);
