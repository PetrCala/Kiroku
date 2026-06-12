import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Animated, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import {PressableWithFeedback} from '@components/Pressable';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {Calendar} from 'react-native-calendars';
import type {DateData} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import {format, parseISO, startOfMonth} from 'date-fns';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemePreference from '@hooks/useThemePreference';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import Navigation from '@libs/Navigation/Navigation';
import DateUtils from '@libs/DateUtils';
import setCalendarLocale from '@libs/setCalendarLocale';
import * as FeatureFlags from '@libs/FeatureFlags';
import type {DateString, UserID} from '@src/types/onyx/OnyxCommon';
import Text from '@components/Text';
import DayComponent from './DayComponent';
import type {DayComponentProps} from './types';
import CalendarArrow from './CalendarArrow';
import type {Direction} from './CalendarArrow';

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

  /** Earliest tracked day ('yyyy-MM-dd'). Days before it render dimmed (like
   *  future days) but stay clickable. Styling-only — distinct from `minDate`,
   *  which gates clickability/navigation. */
  trackingStartDate?: string;

  /** Tapped-day handler; omit to make the calendar non-interactive */
  onDayPress?: (day: DateData) => void;

  /** Long-pressed-day handler; omit to disable the long-press shortcut */
  onDayLongPress?: (day: DateData) => void;

  /** Month-arrow handlers; omit (with hideArrows) to make the calendar static */
  onLeftArrowPress?: (subtractMonth: () => void) => void;
  onRightArrowPress?: (addMonth: () => void) => void;

  /** Snap the calendar back to the current month. When provided, a revert
   *  control appears in the header while the user is viewing a past month. */
  onJumpToCurrent?: () => void;

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
  trackingStartDate,
  onDayPress,
  onDayLongPress,
  onLeftArrowPress,
  onRightArrowPress,
  onJumpToCurrent,
  hideArrows,
  hideMonthHeader,
  hideDayNames,
  isFetchingOlderMonths,
}: SessionsCalendarViewProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const {translate} = useLocalize();
  const themePreference = useThemePreference();
  const [preferredLocale] = useOnyx(ONYXKEYS.NVP_PREFERRED_LOCALE);
  const locale = preferredLocale ?? CONST.LOCALES.DEFAULT;
  // Localizes the month header below (date-fns ignores the global default
  // unless an explicit `locale` is passed) and, by being a dependency of
  // `renderHeader`, forces `<Calendar>` to re-render on a locale change so the
  // library re-reads its (now-updated) day-name locale too.
  const dateFnsLocale = DateUtils.getDateFnsLocale(locale);

  useEffect(() => {
    setCalendarLocale(locale);
  }, [locale]);

  const dayComponent = useCallback(
    ({date, state, marking, theme: dayTheme}: DayComponentProps) => (
      <DayComponent
        date={date}
        state={state}
        units={date ? unitsMap.get(date.dateString as DateString) : 0}
        marking={marking}
        theme={dayTheme}
        trackingStartDate={trackingStartDate}
        onPress={onDayPress}
        onLongPress={onDayLongPress}
      />
    ),
    [unitsMap, trackingStartDate, onDayPress, onDayLongPress],
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
    // Clamp the target to the current month when the user is viewing a future
    // month — the fullscreen calendar never scrolls past today.
    const visible = new Date(visibleDate.timestamp);
    const today = new Date();
    const clamped =
      startOfMonth(visible).getTime() > startOfMonth(today).getTime()
        ? today
        : visible;
    const monthYear = format(clamped, 'yyyy-MM');
    Navigation.navigate(
      ROUTES.SESSIONS_CALENDAR_FULLSCREEN.getRoute(userID, monthYear),
    );
  }, [userID, visibleDate.timestamp]);

  const isCurrentMonth = useMemo(
    () =>
      startOfMonth(new Date(visibleDate.timestamp)).getTime() ===
      startOfMonth(new Date()).getTime(),
    [visibleDate.timestamp],
  );
  // The revert control only makes sense once the user has paged off the
  // current month, and only when the host wired up a jump handler.
  const showRevert = !!onJumpToCurrent && !isCurrentMonth;

  // Fade the revert control in whenever it (re)appears — mirrors the
  // jump-to-latest treatment on the Statistics range navigator.
  const [revertOpacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!showRevert) {
      return;
    }
    revertOpacity.setValue(0);
    Animated.timing(revertOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [showRevert, revertOpacity]);

  const renderHeader = useCallback(
    (date?: {getTime(): number}) => {
      if (hideMonthHeader || !date) {
        return null;
      }
      const formatted = format(
        new Date(date.getTime()),
        CONST.DATE.MONTH_YEAR_ABBR_FORMAT,
        {locale: dateFnsLocale},
      );
      const monthText = (
        <Text style={styles.sessionsCalendarHeaderMonthText}>{formatted}</Text>
      );
      // Right slot holds at most one of: the older-months spinner (priority) or
      // the revert control. Computed up front to avoid a nested ternary in JSX.
      let rightSlotContent: React.ReactNode = null;
      if (isFetchingOlderMonths) {
        rightSlotContent = (
          <ActivityIndicator size="small" color={theme.spinner} />
        );
      } else if (showRevert) {
        rightSlotContent = (
          <Animated.View style={{opacity: revertOpacity}}>
            <PressableWithFeedback
              onPress={onJumpToCurrent}
              role={CONST.ROLE.BUTTON}
              accessibilityLabel={translate(
                'sessionsCalendar.jumpToCurrentMonth',
              )}
              // Auto-pad the small pill out to the minimum touch target without
              // growing its visual size.
              shouldUseAutoHitSlop
              style={styles.sessionsCalendarHeaderRevert}>
              <Icon
                src={KirokuIcons.RotateLeft}
                fill={theme.textReversed}
                width={14}
                height={14}
              />
            </PressableWithFeedback>
          </Animated.View>
        );
      }
      return (
        // Mirrors the Statistics range navigator: a phantom left spacer matches
        // the right slot so the month label stays centered and never shifts
        // when the revert control or older-months spinner toggle in/out.
        <View style={styles.sessionsCalendarHeader}>
          <View style={styles.sessionsCalendarHeaderSideSlot} />
          {isHeaderTappable ? (
            <PressableWithFeedback
              onPress={onHeaderPress}
              role={CONST.ROLE.BUTTON}
              accessibilityLabel={formatted}
              style={styles.sessionsCalendarHeaderLabel}>
              {monthText}
              <Icon
                src={KirokuIcons.DownArrow}
                fill={theme.textSupporting}
                width={12}
                height={12}
                additionalStyles={styles.sessionsCalendarHeaderCaret}
              />
            </PressableWithFeedback>
          ) : (
            <View style={styles.sessionsCalendarHeaderLabel}>{monthText}</View>
          )}
          <View style={styles.sessionsCalendarHeaderSideSlot}>
            {rightSlotContent}
          </View>
        </View>
      );
    },
    [
      dateFnsLocale,
      hideMonthHeader,
      isFetchingOlderMonths,
      isHeaderTappable,
      onHeaderPress,
      onJumpToCurrent,
      showRevert,
      revertOpacity,
      translate,
      styles.sessionsCalendarHeader,
      styles.sessionsCalendarHeaderLabel,
      styles.sessionsCalendarHeaderCaret,
      styles.sessionsCalendarHeaderMonthText,
      styles.sessionsCalendarHeaderSideSlot,
      styles.sessionsCalendarHeaderRevert,
      theme.spinner,
      theme.textReversed,
      theme.textSupporting,
    ],
  );

  // Side-swipe → change month. The library's built-in `enableSwipeMonths` is
  // off because it bypasses the orchestrator's lazy-load hook; we feed the
  // existing arrow handlers instead so the same prefetch path fires. The
  // `subtractMonth/addMonth` callback they take is the lib's internal cursor
  // updater — irrelevant here since `current` is driven by `visibleDate`.
  const resolvedMinDate = minDate ?? CONST.DATE.MIN_DATE;
  const resolvedMaxDate =
    maxDate ?? format(new Date(), CONST.DATE.CALENDAR_FORMAT);
  const goToPreviousMonth = useCallback(() => {
    if (!onLeftArrowPress) {
      return;
    }
    const visibleMonth = startOfMonth(new Date(visibleDate.timestamp));
    if (visibleMonth <= startOfMonth(parseISO(resolvedMinDate))) {
      return;
    }
    onLeftArrowPress(() => {});
  }, [onLeftArrowPress, visibleDate.timestamp, resolvedMinDate]);
  const goToNextMonth = useCallback(() => {
    if (!onRightArrowPress) {
      return;
    }
    const visibleMonth = startOfMonth(new Date(visibleDate.timestamp));
    if (visibleMonth >= startOfMonth(parseISO(resolvedMaxDate))) {
      return;
    }
    onRightArrowPress(() => {});
  }, [onRightArrowPress, visibleDate.timestamp, resolvedMaxDate]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        // Activate only after clear horizontal intent so day-cell taps and
        // scroll-locked vertical pans still win uncontested.
        .activeOffsetX([-15, 15])
        .failOffsetY([-20, 20])
        .onEnd(e => {
          'worklet';

          const SWIPE_THRESHOLD = 60;
          const VELOCITY_THRESHOLD = 400;
          if (
            e.translationX < -SWIPE_THRESHOLD ||
            e.velocityX < -VELOCITY_THRESHOLD
          ) {
            runOnJS(goToNextMonth)();
          } else if (
            e.translationX > SWIPE_THRESHOLD ||
            e.velocityX > VELOCITY_THRESHOLD
          ) {
            runOnJS(goToPreviousMonth)();
          }
        }),
    [goToPreviousMonth, goToNextMonth],
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <View collapsable={false}>
        <Calendar
          // Remount on theme change only — belt-and-suspenders for the lib's
          // first-mount stylesheet snapshot (patched in
          // `patches/react-native-calendars+*.patch`). The month must NOT be
          // in this key: a key change unmounts + remounts the grid, blanking it
          // for a frame — that remount was the month-paging flicker on the
          // home/profile calendars.
          key={themePreference}
          // Drive the visible month from `initialDate`, not `current`. The lib
          // seeds its internal cursor from `current` only once (initial
          // `useState`) and never reacts to later `current` changes, but it
          // *does* run a `useEffect([initialDate])` that pushes prop updates
          // into that cursor. So both paths stay in sync without a remount:
          // arrow presses (which also call the lib's `subtractMonth`/`addMonth`)
          // and swipes (which only update `visibleDate` → `initialDate`).
          initialDate={visibleDate.dateString}
          dayComponent={dayComponent}
          minDate={resolvedMinDate}
          maxDate={resolvedMaxDate}
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
          // Drop the library's default 20px arrow hit-slop: combined with the
          // wide arrow touch container it bled over the header's revert button
          // and swallowed its taps. The arrow target stays comfortable via its
          // own width + padding.
          arrowsHitSlop={0}
          renderArrow={(direction: Direction) => CalendarArrow(direction)}
          style={styles.sessionsCalendarContainer}
          theme={StyleUtils.getSessionsCalendarStyle()}
          // @ts-expect-error locale prop exists at runtime but is not declared in types
          locale={locale}
        />
      </View>
    </GestureDetector>
  );
}

SessionsCalendarView.displayName = 'SessionsCalendarView';
export default memo(SessionsCalendarView);
export type {SessionsCalendarViewProps};
