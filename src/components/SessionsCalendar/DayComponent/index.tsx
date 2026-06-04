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
  onPress,
}: DayComponentProps) {
  const StyleUtils = useStyleUtils();
  const isDisabled = state === 'disabled';
  const unitsText =
    !isDisabled && units !== undefined && units > 0
      ? (Number.isInteger(units) ? units : units.toFixed(1)).toString()
      : '';

  return (
    <View>
      <PressableWithFeedback
        accessibilityLabel=""
        disabled={isDisabled}
        onPress={() => onPress && date && onPress(date)}>
        <View
          style={StyleUtils.getSessionsCalendarDayCellStyle(
            marking,
            isDisabled,
          )}>
          <Text
            style={StyleUtils.getSessionsCalendarDayLabelStyle(
              marking,
              isDisabled,
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
