import {View} from 'react-native';
import Text from '@components/Text';
import {PressableWithoutFeedback} from '@components/Pressable';
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
  const isToday = state === 'today';
  const unitsText =
    !isDisabled && units !== undefined && units > 0
      ? (Number.isInteger(units) ? units : units.toFixed(1)).toString()
      : '';

  return (
    <PressableWithoutFeedback
      accessibilityLabel=""
      onPress={() => onPress && date && onPress(date)}>
      <View
        style={StyleUtils.getSessionsCalendarDayCellStyle(
          marking,
          isDisabled,
          isToday,
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
    </PressableWithoutFeedback>
  );
}

export default DayComponent;
