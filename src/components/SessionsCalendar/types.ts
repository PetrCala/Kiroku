import type {DrinkingSessionList, Preferences} from '@src/types/onyx';
import type {DateString, UserID} from '@src/types/onyx/OnyxCommon';
import type {DateData} from 'react-native-calendars';
import type {MarkingProps} from 'react-native-calendars/src/calendar/day/marking';
import type {DayComponentProps, CalendarColors} from './DayComponent/types';

type SessionsCalendarProps = {
  /** ID of the user for which to render the calendar */
  userID: UserID;

  /** The currently visible date */
  visibleDate: DateData;

  /** Callback for when the date changes */
  onDateChange: (date: DateData) => void;

  /** The drinking session to render */
  drinkingSessionData: DrinkingSessionList | null | undefined;

  /** User's preferences */
  preferences: Preferences;

  /** Show an inline spinner next to the month header while older months are
   *  being fetched after a back-nav past the loaded window edge. */
  isFetchingOlderMonths?: boolean;

  /** Fullscreen-only. Fires when a day is tapped in the infinite calendar so
   *  the host screen can open the day drill-down sheet. In `compact` mode taps
   *  navigate to the day-overview scroll instead. */
  onDayDrillDown?: (date: DateString) => void;

  /** dayList-only. Render the session tiles non-interactively (viewing another
   *  user's history). Also suppresses the "last viewed day" persistence so it
   *  doesn't repoint the current user's own compact calendar. */
  isReadOnly?: boolean;

  /**
   * Rendering mode:
   * - `compact` (default): fixed-size single-month `Calendar` with arrow
   *   pagination. The original embedded variant used on Home/Profile.
   * - `fullscreen`: virtualized vertical week list, used on the dedicated
   *   full-screen calendar route.
   * - `dayList`: continuous, all-days scroll of session tiles grouped by day,
   *   used by the day-overview screen.
   */
  mode?: 'compact' | 'fullscreen' | 'dayList';

  /** Fullscreen-only. Month to center on first render, formatted as
   *  'YYYY-MM'. Carried from the small calendar's header tap. */
  initialMonthYear?: string;

  /** dayList-only. Day ('YYYY-MM-DD') to land on at first render. */
  initialDay?: DateString;

  /** dayList-only. Debounced report of the center-most visible day as the user
   *  scrolls — used to open the add-session picker on the viewed month. */
  onVisibleDayChange?: (day: DateString) => void;

  /** Fullscreen/dayList. Fires once the scroll view has applied its initial
   *  scroll (or determined it doesn't need one). The screen uses this to
   *  drop a loading overlay that hides the brief pre-scroll frame. */
  onInitialScrollReady?: () => void;
};

type SessionsCalendarDayMarking = {
  marking: MarkingProps;
  units: number;
};
type SessionsCalendarMarkedDates = Record<string, SessionsCalendarDayMarking>;

export default SessionsCalendarProps;
export type {
  DayComponentProps,
  CalendarColors,
  SessionsCalendarDayMarking,
  SessionsCalendarMarkedDates,
};
