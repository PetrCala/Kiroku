import {useEffect, useRef} from 'react';
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
  registerMeasureRef,
}: DayComponentProps) {
  const StyleUtils = useStyleUtils();
  const isDisabled = state === 'disabled';
  const unitsText =
    !isDisabled && units !== undefined && units > 0
      ? (Number.isInteger(units) ? units : units.toFixed(1)).toString()
      : '';

  // Register this cell's measure ref with the parent so the parent can call
  // `measureInWindow` on it later (used to seed the fullscreen calendar's
  // initial scroll). We only need a single anchor per visible month; day 1
  // is always in the first week-row of the rendered grid, so that's the cell
  // we expose. The wrapping `<View collapsable={false}>` is required on
  // Android — Fabric/Paper view-flattening can otherwise drop the View and
  // invalidate the ref.
  const viewRef = useRef<View | null>(null);
  // Disabled day-1 cells (e.g. minDate boundary months) still sit in the
  // first week-row at the same Y — register regardless so the fullscreen
  // never silently falls through to "latest at bottom" for those months.
  const shouldRegister = !!registerMeasureRef && !!date && date.day === 1;
  useEffect(() => {
    if (!registerMeasureRef || !date) {
      return undefined;
    }
    if (!shouldRegister) {
      return undefined;
    }
    registerMeasureRef(date.day, viewRef.current);
    return () => registerMeasureRef(date.day, null);
  }, [registerMeasureRef, date, shouldRegister]);

  return (
    <View ref={viewRef} collapsable={false}>
      <PressableWithoutFeedback
        accessibilityLabel=""
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
      </PressableWithoutFeedback>
    </View>
  );
}

export default DayComponent;
