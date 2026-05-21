import React, {memo, useCallback, useEffect, useState} from 'react';
import {Calendar} from 'react-native-calendars';
import type {DateData} from 'react-native-calendars';
import type {MarkingTypes} from 'react-native-calendars/src/types';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import {format} from 'date-fns';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import DayComponent from './DayComponent';
import type {DayComponentProps} from './types';
import CalendarArrow from './CalendarArrow';
import type {Direction} from './CalendarArrow';
import setCalendarLocale from './setCalendarLocale';

type SessionsCalendarViewProps = {
  /** Marked dates payload to forward to react-native-calendars */
  markedDates: MarkedDates;

  /** Per-day total unit counts (used by the day cell to render the number) */
  unitsMap: Map<DateString, number>;

  /** The visible month */
  visibleDate: DateData;

  /** Earliest selectable date (defaults to CONST.DATE.MIN_DATE) */
  minDate?: string;

  /** Latest selectable date (defaults to today) */
  maxDate?: string;

  /** Tapped-day handler; omit to make the calendar non-interactive */
  onDayPress?: (day: DateData) => void;

  /** Month-arrow handlers; omit (with hideArrows) to make the calendar static */
  onLeftArrowPress?: (subtractMonth: () => void) => void;
  onRightArrowPress?: (addMonth: () => void) => void;

  /** Hide month-nav arrows entirely (e.g. for an inline preview) */
  hideArrows?: boolean;
};

/**
 * Presentational calendar — pure props in, pixels out.
 *
 * No data fetching, no Firebase, no Onyx writes. The only side effect is
 * setting the react-native-calendars locale when the user's preferred locale
 * changes (a global library setting, not per-instance).
 *
 * The stateful orchestrator that pairs this with `useLazyMarkedDates` lives in
 * `SessionsCalendar/index.tsx`. Reuse this view directly when you need to
 * render a calendar from hand-crafted data (e.g. the palette-picker preview).
 */
function SessionsCalendarView({
  markedDates,
  unitsMap,
  visibleDate,
  minDate,
  maxDate,
  onDayPress,
  onLeftArrowPress,
  onRightArrowPress,
  hideArrows,
}: SessionsCalendarViewProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const [preferredLocale] = useOnyx(ONYXKEYS.NVP_PREFERRED_LOCALE);
  const [locale, setLocale] = useState<string>(CONST.LOCALES.DEFAULT);

  useEffect(() => {
    const newLocale = preferredLocale ?? CONST.LOCALES.DEFAULT;
    setCalendarLocale(newLocale);
    setLocale(newLocale);
  }, [preferredLocale]);

  const dayComponent = useCallback(
    ({date, state, marking, theme}: DayComponentProps) => (
      <DayComponent
        date={date}
        state={state}
        units={date ? unitsMap.get(date.dateString as DateString) : 0}
        marking={marking}
        theme={theme}
        onPress={onDayPress}
      />
    ),
    [unitsMap, onDayPress],
  );

  return (
    <Calendar
      current={visibleDate.dateString}
      dayComponent={dayComponent}
      minDate={minDate ?? CONST.DATE.MIN_DATE}
      maxDate={maxDate ?? format(new Date(), CONST.DATE.CALENDAR_FORMAT)}
      monthFormat={CONST.DATE.MONTH_YEAR_ABBR_FORMAT}
      onPressArrowLeft={onLeftArrowPress}
      onPressArrowRight={onRightArrowPress}
      markedDates={markedDates}
      markingType={'period' as MarkingTypes}
      firstDay={CONST.WEEK_STARTS_ON}
      enableSwipeMonths={false}
      hideArrows={hideArrows}
      disableAllTouchEventsForDisabledDays
      renderArrow={(direction: Direction) => CalendarArrow(direction)}
      style={styles.sessionsCalendarContainer}
      theme={StyleUtils.getSessionsCalendarStyle()}
      // @ts-expect-error locale prop exists at runtime but is not declared in types
      locale={locale}
    />
  );
}

SessionsCalendarView.displayName = 'SessionsCalendarView';
export default memo(SessionsCalendarView);
export type {SessionsCalendarViewProps};
