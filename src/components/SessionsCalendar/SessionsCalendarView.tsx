import React, {memo, useCallback, useEffect, useRef} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {PressableWithFeedback} from '@components/Pressable';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {Calendar} from 'react-native-calendars';
import type {DateData} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import {format, startOfMonth} from 'date-fns';
import useTheme from '@hooks/useTheme';
import useThemePreference from '@hooks/useThemePreference';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import Navigation from '@libs/Navigation/Navigation';
import * as FeatureFlags from '@libs/FeatureFlags';
import type {DateString, UserID} from '@src/types/onyx/OnyxCommon';
import Text from '@components/Text';
import DayComponent from './DayComponent';
import type {DayComponentProps} from './types';
import CalendarArrow from './CalendarArrow';
import type {Direction} from './CalendarArrow';
import setCalendarLocale from './setCalendarLocale';

type SessionsCalendarViewProps = {
  /** Owning user — required to deep-link to the full-screen calendar route
   *  when the month header is tapped. Optional because hand-crafted previews
   *  (e.g. the palette picker) don't have a user context. */
  userID?: UserID;

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

  /** Hide the month-year text header (e.g. for an inline preview) */
  hideMonthHeader?: boolean;

  /** Hide the day-name row (M T W T F S S) */
  hideDayNames?: boolean;

  /** Show an inline spinner next to the month header while older months are
   *  being fetched after a back-nav past the loaded window edge. */
  isFetchingOlderMonths?: boolean;
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
  userID,
  markedDates,
  unitsMap,
  visibleDate,
  minDate,
  maxDate,
  onDayPress,
  onLeftArrowPress,
  onRightArrowPress,
  hideArrows,
  hideMonthHeader,
  hideDayNames,
  isFetchingOlderMonths,
}: SessionsCalendarViewProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const themePreference = useThemePreference();
  const [preferredLocale] = useOnyx(ONYXKEYS.NVP_PREFERRED_LOCALE);
  const locale = preferredLocale ?? CONST.LOCALES.DEFAULT;

  useEffect(() => {
    setCalendarLocale(locale);
  }, [locale]);

  // Ref to the day-1 cell of the visible month. Used to measure the
  // first-week-row's window-Y so the fullscreen calendar can position the
  // clicked month at the same screen position. Stable across renders.
  const day1Ref = useRef<View | null>(null);
  const registerMeasureRef = useCallback((day: number, view: View | null) => {
    if (day === 1) {
      day1Ref.current = view;
    }
  }, []);

  const dayComponent = useCallback(
    ({date, state, marking, theme: dayTheme}: DayComponentProps) => (
      <DayComponent
        date={date}
        state={state}
        units={date ? unitsMap.get(date.dateString as DateString) : 0}
        marking={marking}
        theme={dayTheme}
        onPress={onDayPress}
        registerMeasureRef={registerMeasureRef}
      />
    ),
    [unitsMap, onDayPress, registerMeasureRef],
  );

  // Custom header: matches the default month-text styling but reserves space
  // for an inline spinner shown only while an older-months fetch is in flight.
  // Keeping the header always-customized (not just when fetching) avoids a
  // layout jump between native-header and custom-header rendering.
  // The lib passes an `XDate` (no published d.ts; treated as `any` here). All we
  // need is its epoch — extract via `getTime()` and rebuild a native `Date`.
  const isHeaderTappable =
    !!userID && FeatureFlags.isEnabled('FULLSCREEN_CALENDAR');

  const onHeaderPress = useCallback(() => {
    if (!userID) {
      return;
    }
    // Clamp the target to current month if the user is viewing a future
    // month. The measured Y stays the same regardless — what we're matching
    // is the small calendar's first-week-row position, not its month.
    const visible = new Date(visibleDate.timestamp);
    const today = new Date();
    const clamped =
      startOfMonth(visible).getTime() > startOfMonth(today).getTime()
        ? today
        : visible;
    const monthYear = format(clamped, 'yyyy-MM');

    // `measureInWindow` is async with a callback. If the day-1 cell hasn't
    // mounted yet (very rare — the press requires a tap on the header which
    // sits above the grid), fall through to navigating without a Y, which
    // falls back to "latest at bottom".
    const navigate = (firstWeekY?: number) => {
      Navigation.navigate(
        ROUTES.SESSIONS_CALENDAR_FULLSCREEN.getRoute(
          userID,
          monthYear,
          firstWeekY,
        ),
      );
    };
    if (!day1Ref.current) {
      navigate();
      return;
    }
    day1Ref.current.measureInWindow((_x, y) => navigate(y));
  }, [userID, visibleDate.timestamp]);

  const renderHeader = useCallback(
    (date?: {getTime(): number}) => {
      if (hideMonthHeader || !date) {
        return null;
      }
      const formatted = format(
        new Date(date.getTime()),
        CONST.DATE.MONTH_YEAR_ABBR_FORMAT,
      );
      const monthText = (
        <Text style={styles.sessionsCalendarHeaderMonthText}>{formatted}</Text>
      );
      const expandIcon = isHeaderTappable ? (
        <Icon
          src={KirokuIcons.ArrowUpDown}
          fill={theme.textSupporting}
          width={14}
          height={14}
          additionalStyles={styles.sessionsCalendarExpandIcon}
        />
      ) : null;
      return (
        <View style={styles.sessionsCalendarHeader}>
          {isHeaderTappable ? (
            <PressableWithFeedback
              onPress={onHeaderPress}
              role={CONST.ROLE.BUTTON}
              accessibilityLabel={formatted}
              style={styles.sessionsCalendarHeader}>
              {monthText}
              {expandIcon}
            </PressableWithFeedback>
          ) : (
            monthText
          )}
          {isFetchingOlderMonths && (
            <ActivityIndicator
              size="small"
              color={theme.spinner}
              style={styles.sessionsCalendarHeaderSpinner}
            />
          )}
        </View>
      );
    },
    [
      hideMonthHeader,
      isFetchingOlderMonths,
      isHeaderTappable,
      onHeaderPress,
      styles.sessionsCalendarExpandIcon,
      styles.sessionsCalendarHeader,
      styles.sessionsCalendarHeaderMonthText,
      styles.sessionsCalendarHeaderSpinner,
      theme.spinner,
      theme.textSupporting,
    ],
  );

  return (
    <Calendar
      // Remount on theme change as a safety net. The library snapshots its
      // derived stylesheet at first mount (patched in
      // `patches/react-native-calendars+*.patch`); this `key` is belt-and-
      // suspenders so the chrome still recovers if the patch ever fails to
      // apply (e.g. a fresh `node_modules` before postinstall has run).
      key={themePreference}
      current={visibleDate.dateString}
      dayComponent={dayComponent}
      minDate={minDate ?? CONST.DATE.MIN_DATE}
      maxDate={maxDate ?? format(new Date(), CONST.DATE.CALENDAR_FORMAT)}
      monthFormat={CONST.DATE.MONTH_YEAR_ABBR_FORMAT}
      onPressArrowLeft={onLeftArrowPress}
      onPressArrowRight={onRightArrowPress}
      markedDates={markedDates}
      markingType="period"
      firstDay={CONST.WEEK_STARTS_ON}
      enableSwipeMonths={false}
      hideArrows={hideArrows}
      hideDayNames={hideDayNames}
      renderHeader={renderHeader}
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
