import {View} from 'react-native';
import Text from '@components/Text';
import {PressableWithoutFeedback} from '@components/Pressable';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import type {DayComponentProps} from '@components/SessionsCalendar/types';

function DayComponent({
  date,
  state,
  units,
  marking,
  theme, // eslint-disable-line @typescript-eslint/no-unused-vars
  onPress,
}: DayComponentProps) {
  const styles = useThemeStyles();
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
      style={[
        styles.alignItemsCenter,
        styles.justifyContentCenter,
        // styles.mnw100, // Uncomment to offset the text labels to the left
      ]}
      onPress={() => onPress && date && onPress(date)}>
      <Text
        style={StyleUtils.getSessionsCalendarDayLabelStyle(
          isDisabled,
          isToday,
        )}>
        {date?.day}
      </Text>
      <View
        style={StyleUtils.getSessionsCalendarDayMarkingContainerStyle(
          marking,
          isDisabled,
        )}>
        <Text
          style={StyleUtils.getSessionsCalendarDayMarkingTextStyle(marking)}>
          {unitsText}
        </Text>
      </View>
    </PressableWithoutFeedback>
  );
}

export default DayComponent;
