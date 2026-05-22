import React, {memo, useCallback, useEffect, useMemo} from 'react';
import {CalendarList} from 'react-native-calendars';
import type {DateData} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import {differenceInCalendarMonths, format, parseISO} from 'date-fns';
import useThemePreference from '@hooks/useThemePreference';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import DayComponent from './DayComponent';
import type {DayComponentProps} from './types';
import setCalendarLocale from './setCalendarLocale';

type SessionsCalendarListViewProps = {
  /** Marked dates payload to forward to react-native-calendars */
  markedDates: MarkedDates;

  /** Per-day total unit counts (used by the day cell to render the number) */
  unitsMap: Map<DateString, number>;

  /** Initial visible month */
  visibleDate: DateData;

  /** Earliest selectable date — also caps how far back the list can scroll */
  minDate?: string;

  /** Latest selectable date (defaults to today) */
  maxDate?: string;

  /** Tapped-day handler */
  onDayPress?: (day: DateData) => void;

  /** Called whenever the list scrolls to a new set of visible months. The
   *  fullscreen orchestrator uses this to extend the loaded session window
   *  ahead of the user's scroll. */
  onVisibleMonthsChange?: (months: DateData[]) => void;
};

/**
 * Scrollable, virtualized variant of `SessionsCalendarView`.
 *
 * Wraps `CalendarList` in horizontal + paging mode so the user can swipe
 * through months one-by-one quickly. Reuses the same `DayComponent`, theme,
 * locale effect, and marked-dates payload as the compact view — only the
 * outer chrome and the month-loading trigger differ.
 */
function SessionsCalendarListView({
  markedDates,
  unitsMap,
  visibleDate,
  minDate,
  maxDate,
  onDayPress,
  onVisibleMonthsChange,
}: SessionsCalendarListViewProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const themePreference = useThemePreference();
  const [preferredLocale] = useOnyx(ONYXKEYS.NVP_PREFERRED_LOCALE);
  const locale = preferredLocale ?? CONST.LOCALES.DEFAULT;

  useEffect(() => {
    setCalendarLocale(locale);
  }, [locale]);

  const resolvedMinDate = minDate ?? CONST.DATE.MIN_DATE;
  const resolvedMaxDate =
    maxDate ?? format(new Date(), CONST.DATE.CALENDAR_FORMAT);

  // The list virtualizes within a finite past/future window. Derive the past
  // range from `minDate` so the user can't scroll past their tracking-start
  // boundary — the calendar simply stops, no extra "you've reached the start"
  // UI needed. `+1` to include the boundary month itself.
  const pastScrollRange = useMemo(() => {
    const earliest = parseISO(resolvedMinDate);
    return Math.max(0, differenceInCalendarMonths(new Date(), earliest) + 1);
  }, [resolvedMinDate]);

  const dayComponent = useCallback(
    ({date, state, marking, theme: dayTheme}: DayComponentProps) => (
      <DayComponent
        date={date}
        state={state}
        units={date ? unitsMap.get(date.dateString as DateString) : 0}
        marking={marking}
        theme={dayTheme}
        onPress={onDayPress}
      />
    ),
    [unitsMap, onDayPress],
  );

  return (
    <CalendarList
      // See the compact view for the rationale on the theme-remount key — same
      // belt-and-suspenders against the styleConstructor snapshot patch.
      key={themePreference}
      current={visibleDate.dateString}
      minDate={resolvedMinDate}
      maxDate={resolvedMaxDate}
      pastScrollRange={pastScrollRange}
      futureScrollRange={0}
      horizontal
      pagingEnabled
      showScrollIndicator={false}
      monthFormat={CONST.DATE.MONTH_YEAR_ABBR_FORMAT}
      dayComponent={dayComponent}
      markedDates={markedDates}
      markingType="period"
      firstDay={CONST.WEEK_STARTS_ON}
      hideArrows
      disableAllTouchEventsForDisabledDays
      onVisibleMonthsChange={onVisibleMonthsChange}
      style={styles.sessionsCalendarContainer}
      theme={StyleUtils.getSessionsCalendarStyle()}
      // @ts-expect-error locale prop exists at runtime but is not declared in types
      locale={locale}
    />
  );
}

SessionsCalendarListView.displayName = 'SessionsCalendarListView';
export default memo(SessionsCalendarListView);
export type {SessionsCalendarListViewProps};
