﻿import React, {useEffect, useState} from 'react';
import {DateData} from 'react-native-calendars';
import {Dimensions, StyleSheet} from 'react-native';
import {Calendar} from 'react-native-calendars';
import {
  getPreviousMonth,
  getNextMonth,
  aggregateSessionsByDays,
  monthEntriesToColors,
} from '@libs/DataHandling';
import type {DrinkingSessionArray, Preferences} from '@src/types/onyx';
import useTheme from '@hooks/useTheme';
import FullScreenLoadingIndicator from '../FullscreenLoadingIndicator';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import SessionsCalendarProps, {
  DayComponentProps,
  SessionsCalendarMarkedDates,
} from './types';
import CalendarArrow from './CalendarArrow';
import DayComponent from './DayComponent';

function SessionsCalendar({
  userID,
  visibleDate,
  onDateChange,
  drinkingSessionData,
  preferences,
}: SessionsCalendarProps) {
  const theme = useTheme();
  const styles = useThemeStyles();

  const [calendarData, setCalendarData] = useState<DrinkingSessionArray>(
    drinkingSessionData ? Object.values(drinkingSessionData) : [],
  );
  const [markedDates, setMarkedDates] = useState<SessionsCalendarMarkedDates>(
    {},
  );
  const [loadingMarkedDates, setLoadingMarkedDays] = useState<boolean>(true);

  const getMarkedDates = (
    calendarData: DrinkingSessionArray,
    preferences: Preferences,
  ): SessionsCalendarMarkedDates => {
    // Use points to calculate the point sum (flagged as units)
    const aggergatedSessions = aggregateSessionsByDays(
      calendarData,
      'units',
      preferences.drinks_to_units,
    );
    const newMarkedDates = monthEntriesToColors(
      aggergatedSessions,
      preferences,
    );
    return newMarkedDates;
  };

  /** Handler for the left arrow calendar press. Uses a callback to
   * move to the previous month
   *
   * @param subtractMonth A callback to move the months
   */
  const handleLeftArrowPress = (subtractMonth: () => void) => {
    const previousMonth = getPreviousMonth(visibleDate);
    onDateChange(previousMonth);
    subtractMonth(); // Use the callback to move to the previous month
  };

  /** Handler for the left arrow calendar press. Uses a callback to
   * move to the following month
   *
   * @param addMonth A callback to move the months
   */
  const handleRightArrowPress = (addMonth: () => void) => {
    const nextMonth = getNextMonth(visibleDate);
    onDateChange(nextMonth);
    addMonth(); // Use the callback to move to the next month
  };

  const onDayPress = (date: DateData) => {
    console.log('Day pressed', date);
  };

  // Monitor the local calendarData hook that depends on the drinking session data
  useEffect(() => {
    const newData = drinkingSessionData
      ? Object.values(drinkingSessionData)
      : [];
    setCalendarData(newData);
  }, [drinkingSessionData]);

  // Monitor marked days
  useEffect(() => {
    const newMarkedDates = getMarkedDates(calendarData, preferences);
    setMarkedDates(newMarkedDates);
    setLoadingMarkedDays(false);
  }, [calendarData, preferences]);

  if (loadingMarkedDates) {
    return <FullScreenLoadingIndicator />;
  }

  return (
    <Calendar
      current={visibleDate.dateString}
      dayComponent={({date, state, marking, theme}: DayComponentProps) => (
        <DayComponent
          date={date}
          state={state}
          marking={marking}
          theme={theme}
          onPress={onDayPress}
        />
      )}
      monthFormat={CONST.DATE.MONTH_YEAR_ABBR_FORMAT}
      onPressArrowLeft={(subtractMonth: () => void) =>
        handleLeftArrowPress(subtractMonth)
      }
      onPressArrowRight={(addMonth: () => void) =>
        handleRightArrowPress(addMonth)
      }
      markedDates={markedDates}
      markingType={'period'}
      firstDay={preferences.first_day_of_week === 'Monday' ? 1 : 0}
      enableSwipeMonths={false}
      disableAllTouchEventsForDisabledDays={true}
      renderArrow={CalendarArrow}
      style={[
        localStyles.mainScreenCalendarStyle,
        {
          borderColor: theme.border,
        },
      ]}
      theme={
        {
          textDayHeaderFontWeight: 'bold',
          'stylesheet.calendar.header': {
            header: {
              width: screenWidth,
              marginLeft: -5,
              flexDirection: 'row',
              alignItems: 'center',
              borderTopWidth: 1,
              borderColor: theme.border,
            },
            monthText: {
              color: theme.text,
              fontSize: 20,
              fontWeight: '500',
              width: screenWidth / 3,
              textAlign: 'center',
            },
          },
        } as any
      } // Circumvent typescript gymnastics
    />
  );
}

const screenWidth = Dimensions.get('window').width;

const localStyles = StyleSheet.create({
  // Calendar styles
  mainScreenCalendarStyle: {
    width: '100%',
    borderTopWidth: 0,
    borderBottomWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
  },
});

SessionsCalendar.displayName = 'SessionsCalendar';
export default SessionsCalendar;