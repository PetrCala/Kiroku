import {
  addMonths,
  endOfDay,
  endOfMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import React, {useState} from 'react';
import {View} from 'react-native';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import DateUtils from '@libs/DateUtils';
import Str from '@libs/common/str';
import CONST from '@src/CONST';
import generateMonthMatrix from '@components/DatePicker/CalendarPicker/generateMonthMatrix';
import ArrowIcon from '@components/DatePicker/CalendarPicker/ArrowIcon';

type RangeCalendarProps = {
  initialStart: Date;
  initialEnd: Date;
  /** Earliest selectable day (inclusive). */
  minDate?: Date;
  /** Latest selectable day (inclusive). */
  maxDate?: Date;
  /** Fired whenever an anchored range is completed (second tap). */
  onChange: (start: Date, end: Date) => void;
};

/**
 * Range-aware calendar. Maintains its own anchor / pending end and emits a
 * `(start, end)` pair once a second day is tapped. Visually highlights every
 * day inside `[min(a, b), max(a, b)]`.
 */
function RangeCalendar({
  initialStart,
  initialEnd,
  minDate = new Date(2000, 0, 1),
  maxDate = new Date(),
  onChange,
}: RangeCalendarProps) {
  const themeStyles = useThemeStyles();
  const theme = useTheme();
  const {preferredLocale, translate} = useLocalize();

  const [monthView, setMonthView] = useState<Date>(() =>
    startOfMonth(initialStart),
  );
  const [anchor, setAnchor] = useState<Date>(initialStart);
  const [endDate, setEndDate] = useState<Date | null>(initialEnd);

  const handleDayPress = (day: number) => {
    const picked = new Date(monthView.getFullYear(), monthView.getMonth(), day);

    if (endDate === null) {
      // Second tap completes the range.
      const [start, end] =
        picked >= anchor
          ? [startOfDay(anchor), endOfDay(picked)]
          : [startOfDay(picked), endOfDay(anchor)];
      setEndDate(picked);
      onChange(start, end);
      return;
    }

    // First tap of a new range: clear the previous end.
    setAnchor(picked);
    setEndDate(null);
  };

  const monthMatrix = generateMonthMatrix(
    monthView.getFullYear(),
    monthView.getMonth(),
  );
  const monthNames = DateUtils.getMonthNames(preferredLocale).map(month =>
    Str.recapitalize(month),
  );
  const daysOfWeek = DateUtils.getDaysOfWeek(preferredLocale).map(day =>
    day.toUpperCase(),
  );

  const inRange = (day: number): boolean => {
    if (!endDate) {
      return false;
    }
    const date = new Date(monthView.getFullYear(), monthView.getMonth(), day);
    const [a, b] = anchor <= endDate ? [anchor, endDate] : [endDate, anchor];
    return date >= startOfDay(a) && date <= endOfDay(b);
  };

  const isAnchor = (day: number): boolean =>
    isSameDay(
      new Date(monthView.getFullYear(), monthView.getMonth(), day),
      anchor,
    );

  const isEnd = (day: number): boolean =>
    !!endDate &&
    isSameDay(
      new Date(monthView.getFullYear(), monthView.getMonth(), day),
      endDate,
    );

  const hasPrev = startOfMonth(monthView) > startOfDay(minDate);
  const hasNext = endOfMonth(monthView) < endOfDay(maxDate);

  return (
    <View>
      <View
        style={[
          themeStyles.calendarHeader,
          themeStyles.flexRow,
          themeStyles.justifyContentBetween,
          themeStyles.alignItemsCenter,
          themeStyles.ph4,
        ]}>
        <Text style={themeStyles.sidebarLinkTextBold}>
          {`${monthNames[monthView.getMonth()]} ${monthView.getFullYear()}`}
        </Text>
        <View style={[themeStyles.flexRow, themeStyles.alignItemsCenter]}>
          <PressableWithFeedback
            shouldUseAutoHitSlop={false}
            disabled={!hasPrev}
            onPress={() => setMonthView(subMonths(monthView, 1))}
            hoverDimmingValue={1}
            accessibilityLabel={translate('common.previous')}>
            <ArrowIcon disabled={!hasPrev} direction={CONST.DIRECTION.LEFT} />
          </PressableWithFeedback>
          <PressableWithFeedback
            shouldUseAutoHitSlop={false}
            disabled={!hasNext}
            onPress={() => setMonthView(addMonths(monthView, 1))}
            hoverDimmingValue={1}
            accessibilityLabel={translate('common.next')}>
            <ArrowIcon disabled={!hasNext} />
          </PressableWithFeedback>
        </View>
      </View>

      <View style={themeStyles.flexRow}>
        {daysOfWeek.map(dayOfWeek => (
          <View
            key={dayOfWeek}
            style={[
              themeStyles.calendarDayRoot,
              themeStyles.flex1,
              themeStyles.justifyContentCenter,
              themeStyles.alignItemsCenter,
            ]}>
            <Text style={themeStyles.sidebarLinkTextBold}>{dayOfWeek[0]}</Text>
          </View>
        ))}
      </View>

      {monthMatrix.map(week => {
        const firstRealDay = week.find(d => !!d) ?? 0;
        const weekKey = `${monthView.getFullYear()}-${monthView.getMonth()}-w${firstRealDay}`;
        return (
          <View key={weekKey} style={themeStyles.flexRow}>
            {week.map((day, index) => {
              const cellKey = day
                ? `${monthView.getFullYear()}-${monthView.getMonth()}-${day}`
                : `${weekKey}-empty-${
                    // eslint-disable-next-line react/no-array-index-key
                    index
                  }`;
              if (!day) {
                return (
                  <View key={cellKey} style={themeStyles.calendarDayRoot} />
                );
              }
              const cellDate = new Date(
                monthView.getFullYear(),
                monthView.getMonth(),
                day,
              );
              const isBeforeMin = cellDate < startOfDay(minDate);
              const isAfterMax = cellDate > endOfDay(maxDate);
              const isDisabled = isBeforeMin || isAfterMax;
              const isEdge = isAnchor(day) || isEnd(day);
              const isInRange = inRange(day);

              let bgColor = 'transparent';
              if (isEdge) {
                bgColor = theme.appColor;
              } else if (isInRange) {
                bgColor = theme.highlightBG;
              }
              const textColor = isEdge ? theme.textReversed : theme.text;

              return (
                <PressableWithoutFeedback
                  key={cellKey}
                  disabled={isDisabled}
                  onPress={() => handleDayPress(day)}
                  style={themeStyles.calendarDayRoot}
                  accessibilityLabel={String(day)}>
                  {() => (
                    <View
                      style={[
                        themeStyles.calendarDayContainer,
                        {backgroundColor: bgColor},
                      ]}>
                      <Text
                        style={
                          isDisabled ? themeStyles.buttonOpacityDisabled : {}
                        }
                        color={isDisabled ? theme.textSupporting : textColor}>
                        {day}
                      </Text>
                    </View>
                  )}
                </PressableWithoutFeedback>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

RangeCalendar.displayName = 'RangeCalendar';

export default RangeCalendar;
