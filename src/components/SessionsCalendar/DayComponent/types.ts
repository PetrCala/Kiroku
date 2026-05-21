import type {DayState, DateData, Theme} from 'react-native-calendars/src/types';
import type {MarkingProps} from 'react-native-calendars/src/calendar/day/marking';

/** A CSS color string (hex like '#FFA500' or a CSS named color) used for a calendar day marking */
type CalendarColors = string;

/** Props for a react native calendar day component */
type DayComponentProps = {
  date?: DateData;
  state?: DayState;
  units?: number;
  marking?: MarkingProps;
  theme?: Theme;
  onPress?: (day: DateData) => void;
};

export type {DayComponentProps, CalendarColors};
