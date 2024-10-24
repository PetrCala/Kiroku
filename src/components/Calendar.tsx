import type {ReactNode} from 'react';
import React, {useEffect, useState, useMemo, useCallback} from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {
  Dimensions,
  // Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {DayState, DateData} from 'react-native-calendars/src/types';
import {Calendar} from 'react-native-calendars';
import {
  getPreviousMonth,
  getNextMonth,
  changeDateBySomeDays,
  getTimestampAtMidnight,
  aggregateSessionsByDays,
  monthEntriesToColors,
  hasDecimalPoint,
  roundToTwoDecimalPlaces,
} from '@libs/DataHandling';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Icon from '@components/Icon';
import type {DateObject} from '@src/types/time';
import type {
  DrinkingSessionArray,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';
import useTheme from '@hooks/useTheme';
import FullScreenLoadingIndicator from './FullscreenLoadingIndicator';

type DayMarking = {
  units?: number;
  color?: string;
  textColor?: string;
};

type CalendarColors = 'yellow' | 'red' | 'orange' | 'black' | 'green';

// type DayState = 'selected' | 'disabled' | 'today' | ''; // Old day state

type SessionsCalendarProps = {
  drinkingSessionData: DrinkingSessionList | undefined;
  preferences: Preferences;
  visibleDateObject: DateObject;
  dispatch: React.Dispatch<any>;
  // setVisibleDateObject: React.Dispatch<React.SetStateAction<DateObject>>;
  onDayPress: (day: DateData) => void;
};

type MarkingProps = {
  selected?: boolean;
  marked?: boolean;
  dotColor?: string;
  disabled?: boolean;
  color?: string; // This is the field causing the issue in your case
};

type SessionsCalendarMarkedDates = Record<string, DayMarking>;

type SessionsCalendarDatesType = Record<
  string,
  {
    units: number;
    blackout: boolean;
  }
>;

const colorToTextColorMap: Record<CalendarColors, string> = {
  yellow: 'black',
  red: 'white',
  orange: 'black',
  black: 'white',
  green: 'white',
};

type DayComponentProps = {
  date?: DateData;
  state?: DayState;
  marking?: DayMarking;
  theme?: any;
  onPress?: (day: DateData) => void;
};

// Custom Day Component
const DayComponent: React.FC<DayComponentProps> = ({
  date,
  state,
  marking,
  theme,
  onPress,
}) => {
  if (!date) {
    return null;
  }
  // Calculate the date information with memos to avoid recalculation
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => changeDateBySomeDays(today, 1), [today]);
  const tomorrowMidnight = useMemo(
    () => getTimestampAtMidnight(tomorrow),
    [tomorrow],
  );

  const dateNoLaterThanToday = useCallback(
    (date: DateData): boolean => {
      return date.timestamp < tomorrowMidnight;
    },
    [tomorrowMidnight],
  );

  const getTextStyle = (state: DayState | undefined): StyleProp<TextStyle> => {
    let textStyle = localStyles.dayText;
    if (state === 'disabled') {
      textStyle = {...textStyle, ...localStyles.dayTextDisabled};
    } else if (state === 'today') {
      textStyle = {...textStyle, ...localStyles.dayTextToday};
    } else {
      textStyle = {...textStyle, ...{color: theme?.textDayColor || 'black'}};
    }
    return textStyle;
  };

  const getMarkingContainerStyle = (
    date: DateData,
    marking?: DayMarking | MarkingProps,
  ) => {
    const baseStyle = localStyles.daySessionsMarkingContainer;
    const validColors: CalendarColors[] = [
      'black',
      'yellow',
      'red',
      'orange',
      'green',
    ];

    if (state === 'disabled') {
      return {...baseStyle, borderWidth: 0};
    }

    if (!dateNoLaterThanToday(date)) {
      return {...baseStyle, borderWidth: 0};
    }

    const color = validColors.includes(marking?.color as CalendarColors)
      ? marking?.color
      : 'green'; // Default to 'green' if color is not in validColors

    return {...baseStyle, backgroundColor: color};
  };

  const getMarkingTextStyle = (marking?: DayMarking) => {
    let baseStyle = localStyles.daySessionMarkingText;

    // Ensure no funky numbers
    if (marking?.units) {
      marking.units = roundToTwoDecimalPlaces(marking.units);
    }

    if (
      marking?.units &&
      hasDecimalPoint(marking.units) &&
      marking.units >= 10
    ) {
      baseStyle = {...baseStyle, fontSize: 15}; // Handle overflow
    }

    if (
      marking?.color &&
      (marking.color as CalendarColors) in colorToTextColorMap &&
      marking.units != 0
    ) {
      return {
        ...baseStyle,
        color: colorToTextColorMap[marking.color as CalendarColors],
      };
    }

    return {...baseStyle, fontSize: 0, color: 'transparent'}; // Default case
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={localStyles.dayContainer}
      onPress={() => onPress && date && onPress(date)} // Guard against undefined onPress
    >
      <Text style={getTextStyle(state)}>{date?.day}</Text>
      <View style={getMarkingContainerStyle(date, marking)}>
        <Text style={getMarkingTextStyle(marking)}>
          {state === 'disabled' ? '' : marking?.units}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

function CustomArrow(direction: string): ReactNode {
  const theme = useTheme();
  return (
    <View
      style={[
        arrowStyles.customArrowContainer,
        direction === 'left'
          ? arrowStyles.leftContainer
          : arrowStyles.rightContainer,
      ]}>
      <Icon
        src={KirokuIcons.BackArrow}
        fill={theme.inverse}
        additionalStyles={[
          // arrowStyles.customArrowIcon,
          direction === 'left'
            ? arrowStyles.customArrowLeft
            : arrowStyles.customArrowRight,
        ]}
      />
      {/* <Text style={arrowStyles.customArrowText}>{direction === 'left' ? '<' : '>'}</Text> */}
    </View>
  );
}

const SessionsCalendar: React.FC<SessionsCalendarProps> = ({
  drinkingSessionData,
  preferences,
  visibleDateObject,
  dispatch,
  onDayPress,
}) => {
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
    const previousMonth = getPreviousMonth(visibleDateObject);
    dispatch({type: 'SET_VISIBLE_DATE_OBJECT', payload: previousMonth});
    subtractMonth(); // Use the callback to move to the previous month
  };

  /** Handler for the left arrow calendar press. Uses a callback to
   * move to the following month
   *
   * @param addMonth A callback to move the months
   */
  const handleRightArrowPress = (addMonth: () => void) => {
    const nextMonth = getNextMonth(visibleDateObject);
    dispatch({type: 'SET_VISIBLE_DATE_OBJECT', payload: nextMonth});
    addMonth(); // Use the callback to move to the next month
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
      current={visibleDateObject.dateString}
      dayComponent={({date, state, marking, theme}: DayComponentProps) => (
        <DayComponent
          date={date}
          state={state}
          marking={marking}
          theme={theme}
          onPress={onDayPress}
        />
      )}
      monthFormat="MMM yyyy"
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
      renderArrow={CustomArrow}
      style={localStyles.mainScreenCalendarStyle}
      theme={
        {
          textDayHeaderFontWeight: 'bold',
          'stylesheet.calendar.header': {
            header: {
              width: screenWidth,
              marginLeft: -5,
              flexDirection: 'row',
              alignItems: 'center',
              margin: 0,
              padding: 0,
              borderTopWidth: 1,
              borderBottomWidth: 0,
              borderColor: 'grey',
              // backgroundColor: '#f2be1c',
              backgroundColor: 'white',
            },
            monthText: {
              color: 'black',
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
};

const screenWidth = Dimensions.get('window').width;

const arrowStyles = StyleSheet.create({
  customArrowContainer: {
    height: 45,
    alignSelf: 'center',
    justifyContent: 'center',
    // backgroundColor: '#f2be1c',
    backgroundColor: 'white',
    alignItems: 'center',
    width: screenWidth / 3,
    marginVertical: -10,
  },
  leftContainer: {
    marginRight: -10,
    marginLeft: -10,
  },
  rightContainer: {
    marginLeft: -10,
  },
  customArrowIcon: {
    height: 20,
    width: 20,
  },
  customArrowLeft: {
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  customArrowRight: {
    alignSelf: 'flex-end',
    marginRight: 15,
    transform: [{rotate: '180deg'}],
  },
});

const localStyles = StyleSheet.create({
  // Day component styles
  dayContainer: {
    // flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // borderWidth: 1,
    // borderColor: '#E0E0E0',
    width: '100%', // Give explicit width and height
    height: 50,
    // borderRadius: 4, // Rounded corners
  },
  dayText: {
    marginTop: 1,
    marginLeft: 2,
    fontSize: 10,
    alignSelf: 'flex-start',
    color: 'black' as string, // allow overrides
  },
  dayTextDisabled: {
    color: '#D3D3D3',
  },
  dayTextToday: {
    color: 'blue', // Blue text for the current day
  },
  daySessionsMarkingContainer: {
    marginTop: 0,
    marginBottom: 5,
    height: 35,
    width: 35,
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 5,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  daySessionMarkingText: {
    fontSize: 18,
    alignSelf: 'center',
  },
  // Calendar styles
  mainScreenCalendarStyle: {
    width: '100%',
    backgroundColor: 'white',
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderColor: 'grey',
    flexGrow: 1,
    flexShrink: 1,
  },
});

export default SessionsCalendar;
export type {
  DayMarking,
  CalendarColors,
  DayState,
  SessionsCalendarDatesType,
  SessionsCalendarMarkedDates,
};
