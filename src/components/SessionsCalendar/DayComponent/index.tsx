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

  return (
    <View>
      <PressableWithFeedback
        accessibilityLabel=""
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
