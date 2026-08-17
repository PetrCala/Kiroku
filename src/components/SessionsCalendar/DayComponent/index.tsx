import {View} from 'react-native';
import Text from '@components/Text';
import {PressableWithFeedback} from '@components/Pressable';
import useStyleUtils from '@hooks/useStyleUtils';
import type {DayComponentProps} from '@components/SessionsCalendar/types';

function DayComponent({
  date,
  state,
  units,
  marking,
  theme, // eslint-disable-line @typescript-eslint/no-unused-vars
  trackingStartDate,
  onPress,
  onLongPress,
}: DayComponentProps) {
  const StyleUtils = useStyleUtils();
  // `isDisabled` gates clickability — set only for out-of-range days (future
  // days, via the calendar's maxDate). `isBeforeTracking` is a styling-only
  // signal for days before the user started tracking: those stay clickable so
  // the user can add a past session, but render dimmed like future days.
  const isDisabled = state === 'disabled';
  const isBeforeTracking =
    !!trackingStartDate && !!date && date.dateString < trackingStartDate;
  const isDimmed = isDisabled || isBeforeTracking;
  const unitsText =
    !isDimmed && units !== undefined && units > 0
      ? (Number.isInteger(units) ? units : units.toFixed(1)).toString()
      : '';
  // A second identifier, carried only by days that actually have sessions.
  // `units` is the signal: it is populated per day only where sessions exist
  // (see `useLazyMarkedDates`), unlike `marking`, which every in-range day gets
  // (sober days included). The pressable's own `calendar-day-<date>` testID
  // cannot answer "does this day hold anything?", because the grid renders a
  // cell for every day of the month, so the App Store screenshot UI test had no
  // way to open a day with real data (ios/KirokuUITests/ScreenshotTests.swift).
  // It lives on the wrapper rather than the pressable because the pressable's
  // testID is also the web e2e selector, and because the pressable is an
  // accessibility element, which hides its own subtree from XCUITest. A testID
  // is only an accessibility identifier, so nothing a user sees changes.
  const hasSessionsTestID =
    date?.dateString && units !== undefined
      ? `calendar-day-${date.dateString}-has-sessions`
      : undefined;

  return (
    <View testID={hasSessionsTestID}>
      <PressableWithFeedback
        accessibilityLabel=""
        testID={
          date?.dateString ? `calendar-day-${date.dateString}` : undefined
        }
        disabled={isDisabled}
        onPress={() => onPress && date && onPress(date)}
        onLongPress={onLongPress ? () => date && onLongPress(date) : undefined}>
        <View
          style={StyleUtils.getSessionsCalendarDayCellStyle(marking, isDimmed)}>
          <Text
            style={StyleUtils.getSessionsCalendarDayLabelStyle(
              marking,
              isDimmed,
            )}>
            {date?.day}
          </Text>
          {unitsText !== '' && (
            <Text
              style={StyleUtils.getSessionsCalendarDayUnitsTextStyle(marking)}>
              {unitsText}
            </Text>
          )}
        </View>
      </PressableWithFeedback>
    </View>
  );
}

export default DayComponent;
