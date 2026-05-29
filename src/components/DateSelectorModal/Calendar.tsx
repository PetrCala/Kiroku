import {
  addMonths,
  endOfDay,
  endOfMonth,
  getYear,
  isSameDay,
  setMonth,
  setYear,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import ScrollView from '@components/ScrollView';
import ArrowIcon from '@components/DatePicker/CalendarPicker/ArrowIcon';
import generateMonthMatrix from '@components/DatePicker/CalendarPicker/generateMonthMatrix';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import DateUtils from '@libs/DateUtils';
import Str from '@libs/common/str';
import CONST from '@src/CONST';
import type {CalendarProps, CalendarView} from './types';

const localStyles = StyleSheet.create({
  gridScroll: {
    maxHeight: 6 * 45,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '33.33%',
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPill: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Unified calendar grid powering both the single-date and date-range pickers.
 * Tapping the "{Month} {Year}" title flips the grid into a year grid, then a
 * month grid (Material-style), so any month is reachable in a couple of taps
 * instead of stepping one month at a time.
 */
function Calendar(props: CalendarProps) {
  const themeStyles = useThemeStyles();
  const theme = useTheme();
  const {preferredLocale, translate} = useLocalize();

  const minDate =
    props.minDate ?? setYear(new Date(), CONST.CALENDAR_PICKER.MIN_YEAR);
  const maxDate =
    props.maxDate ?? setYear(new Date(), CONST.CALENDAR_PICKER.MAX_YEAR);

  const seed = props.mode === 'range' ? props.initialStart : props.initialDate;
  const [view, setView] = useState<CalendarView>('days');
  const [monthView, setMonthView] = useState<Date>(() => startOfMonth(seed));
  const [selected, setSelected] = useState<Date | null>(
    props.mode === 'single' ? props.initialDate : null,
  );
  const [anchor, setAnchor] = useState<Date | null>(
    props.mode === 'range' ? props.initialStart : null,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    props.mode === 'range' ? props.initialEnd : null,
  );

  const monthNames = DateUtils.getMonthNames(preferredLocale).map(month =>
    Str.recapitalize(month),
  );
  const daysOfWeek = DateUtils.getDaysOfWeek(preferredLocale).map(day =>
    day.toUpperCase(),
  );

  const handleDayPress = (day: number) => {
    const picked = new Date(monthView.getFullYear(), monthView.getMonth(), day);

    if (props.mode === 'single') {
      setSelected(picked);
      props.onChangeSingle(startOfDay(picked));
      return;
    }

    if (anchor !== null && endDate === null) {
      // Second tap completes the range.
      const [start, end] =
        picked >= anchor
          ? [startOfDay(anchor), endOfDay(picked)]
          : [startOfDay(picked), endOfDay(anchor)];
      setEndDate(picked);
      props.onChangeRange(start, end);
      return;
    }

    // First tap of a new range: clear the previous end.
    setAnchor(picked);
    setEndDate(null);
  };

  const handleYearPress = (year: number) => {
    setMonthView(prev => setYear(prev, year));
    setView('months');
  };

  const handleMonthPress = (month: number) => {
    setMonthView(prev => setMonth(prev, month));
    setView('days');
  };

  const isDayDisabled = (date: Date): boolean =>
    date < startOfDay(minDate) || date > endOfDay(maxDate);

  const isEdge = (date: Date): boolean => {
    if (props.mode === 'single') {
      return !!selected && isSameDay(date, selected);
    }
    return (
      (!!anchor && isSameDay(date, anchor)) ||
      (!!endDate && isSameDay(date, endDate))
    );
  };

  const isInRange = (date: Date): boolean => {
    if (props.mode === 'single' || !anchor || !endDate) {
      return false;
    }
    const [a, b] = anchor <= endDate ? [anchor, endDate] : [endDate, anchor];
    return date >= startOfDay(a) && date <= endOfDay(b);
  };

  const monthMatrix = generateMonthMatrix(
    monthView.getFullYear(),
    monthView.getMonth(),
  );
  const hasPrev = startOfMonth(monthView) > startOfDay(minDate);
  const hasNext = endOfMonth(monthView) < endOfDay(maxDate);

  const titleLabel = `${monthNames[monthView.getMonth()]} ${monthView.getFullYear()}`;

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
        <PressableWithFeedback
          onPress={() => setView(view === 'days' ? 'years' : 'days')}
          style={[themeStyles.flexRow, themeStyles.alignItemsCenter]}
          hoverDimmingValue={1}
          accessibilityLabel={titleLabel}>
          <Text style={themeStyles.sidebarLinkTextBold}>{titleLabel}</Text>
          <ArrowIcon />
        </PressableWithFeedback>
        {view === 'days' ? (
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
        ) : null}
      </View>

      {view === 'years' ? (
        <ScrollView style={localStyles.gridScroll}>
          <View style={localStyles.grid}>
            {Array.from(
              {length: getYear(maxDate) - getYear(minDate) + 1},
              (_, i) => getYear(maxDate) - i,
            ).map(year => {
              const isSelectedYear = year === monthView.getFullYear();
              return (
                <View key={year} style={localStyles.gridCell}>
                  <PressableWithFeedback
                    onPress={() => handleYearPress(year)}
                    hoverDimmingValue={1}
                    accessibilityLabel={String(year)}
                    style={[
                      localStyles.gridPill,
                      isSelectedYear
                        ? {backgroundColor: theme.appColor}
                        : undefined,
                    ]}>
                    <Text
                      color={isSelectedYear ? theme.textReversed : theme.text}>
                      {year}
                    </Text>
                  </PressableWithFeedback>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {view === 'months' ? (
        <View style={[localStyles.grid, localStyles.gridScroll]}>
          {monthNames.map((monthName, month) => {
            const monthStart = startOfMonth(setMonth(monthView, month));
            const monthEnd = endOfMonth(monthStart);
            const isDisabled =
              monthEnd < startOfDay(minDate) || monthStart > endOfDay(maxDate);
            const isSelectedMonth = month === monthView.getMonth();
            return (
              <View key={monthName} style={localStyles.gridCell}>
                <PressableWithFeedback
                  disabled={isDisabled}
                  onPress={() => handleMonthPress(month)}
                  hoverDimmingValue={1}
                  accessibilityLabel={monthName}
                  style={[
                    localStyles.gridPill,
                    isSelectedMonth
                      ? {backgroundColor: theme.appColor}
                      : undefined,
                  ]}>
                  <Text
                    style={isDisabled ? themeStyles.buttonOpacityDisabled : {}}
                    color={
                      // eslint-disable-next-line no-nested-ternary
                      isDisabled
                        ? theme.textSupporting
                        : isSelectedMonth
                          ? theme.textReversed
                          : theme.text
                    }>
                    {monthName}
                  </Text>
                </PressableWithFeedback>
              </View>
            );
          })}
        </View>
      ) : null}

      {view === 'days' ? (
        <View>
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
                <Text style={themeStyles.sidebarLinkTextBold}>
                  {dayOfWeek[0]}
                </Text>
              </View>
            ))}
          </View>

          {monthMatrix.map(week => {
            const firstRealDay = week.find(d => !!d) ?? 0;
            const weekKey = `${monthView.getFullYear()}-${monthView.getMonth()}-w${firstRealDay}`;
            return (
              <View key={weekKey} style={themeStyles.flexRow}>
                {week.map((day, index) => {
                  if (!day) {
                    return (
                      <View
                        // eslint-disable-next-line react/no-array-index-key
                        key={`${weekKey}-empty-${index}`}
                        style={themeStyles.calendarDayRoot}
                      />
                    );
                  }
                  const cellDate = new Date(
                    monthView.getFullYear(),
                    monthView.getMonth(),
                    day,
                  );
                  const disabled = isDayDisabled(cellDate);
                  const edge = isEdge(cellDate);
                  const inRange = isInRange(cellDate);

                  let bgColor = 'transparent';
                  if (edge) {
                    bgColor = theme.appColor;
                  } else if (inRange) {
                    bgColor = theme.highlightBG;
                  }
                  const textColor = edge ? theme.textReversed : theme.text;

                  return (
                    <PressableWithoutFeedback
                      key={`${monthView.getFullYear()}-${monthView.getMonth()}-${day}`}
                      disabled={disabled}
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
                              disabled ? themeStyles.buttonOpacityDisabled : {}
                            }
                            color={disabled ? theme.textSupporting : textColor}>
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
      ) : null}
    </View>
  );
}

Calendar.displayName = 'Calendar';

export default Calendar;
