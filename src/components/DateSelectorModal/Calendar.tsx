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
import {FlashList} from '@shopify/flash-list';
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import ArrowIcon from '@components/DatePicker/CalendarPicker/ArrowIcon';
import generateMonthMatrix from '@components/DatePicker/CalendarPicker/generateMonthMatrix';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
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

const DAY_CELL_HEIGHT = 45;
const MONTH_CELL_HEIGHT = 48;
const YEAR_LABEL_HEIGHT = 34;
const YEAR_BLOCK_HEIGHT = YEAR_LABEL_HEIGHT + 4 * MONTH_CELL_HEIGHT;
// A month spans 4-6 weeks; pin the grid to the 6-week height so the modal
// never resizes between months (or when switching to the year overview).
const WEEKS_HEIGHT = 6 * DAY_CELL_HEIGHT;
const OVERVIEW_HEIGHT = WEEKS_HEIGHT + DAY_CELL_HEIGHT;

const localStyles = StyleSheet.create({
  header: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerArrow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overview: {
    height: OVERVIEW_HEIGHT,
  },
  weeks: {
    height: WEEKS_HEIGHT,
  },
  yearBlock: {
    height: YEAR_BLOCK_HEIGHT,
  },
  yearLabel: {
    height: YEAR_LABEL_HEIGHT,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '33.33%',
    height: MONTH_CELL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPill: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Unified calendar grid powering both the single-date and date-range pickers.
 * The month view steps months via edge arrows; tapping the centered title opens
 * an Apple-style year overview (months in 3 columns, scrolled vertically) so any
 * month is one tap away.
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
  const [view, setView] = useState<CalendarView>('month');
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
  const monthShortNames = DateUtils.getMonthShortNames(preferredLocale).map(
    month => Str.recapitalize(month),
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

  const handleMonthSelect = (year: number, month: number) => {
    setMonthView(prev => setMonth(setYear(prev, year), month));
    setView('month');
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

  const minYear = getYear(minDate);
  const maxYear = getYear(maxDate);
  const years = Array.from(
    {length: maxYear - minYear + 1},
    (_, i) => minYear + i,
  );
  const initialScrollIndex = Math.max(0, monthView.getFullYear() - minYear);

  const renderYearBlock = ({item: year}: {item: number}) => (
    <View style={localStyles.yearBlock}>
      <View style={localStyles.yearLabel}>
        <Text style={themeStyles.sidebarLinkTextBold}>{year}</Text>
      </View>
      <View style={localStyles.monthGrid}>
        {monthShortNames.map((monthName, month) => {
          const monthStart = startOfMonth(new Date(year, month, 1));
          const monthEnd = endOfMonth(monthStart);
          const isDisabled =
            monthEnd < startOfDay(minDate) || monthStart > endOfDay(maxDate);
          const isSelectedMonth =
            year === monthView.getFullYear() && month === monthView.getMonth();
          return (
            <View key={monthName} style={localStyles.monthCell}>
              <PressableWithFeedback
                disabled={isDisabled}
                onPress={() => handleMonthSelect(year, month)}
                hoverDimmingValue={1}
                accessibilityLabel={`${monthName} ${year}`}
                style={[
                  localStyles.monthPill,
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
    </View>
  );

  return (
    <View>
      <View style={localStyles.header}>
        {view === 'month' ? (
          <PressableWithFeedback
            disabled={!hasPrev}
            onPress={() => setMonthView(subMonths(monthView, 1))}
            hoverDimmingValue={1}
            style={localStyles.headerArrow}
            accessibilityLabel={translate('common.previous')}>
            <ArrowIcon disabled={!hasPrev} direction={CONST.DIRECTION.LEFT} />
          </PressableWithFeedback>
        ) : null}
        <PressableWithFeedback
          onPress={() => setView(view === 'month' ? 'overview' : 'month')}
          hoverDimmingValue={1}
          style={localStyles.headerTitle}
          accessibilityLabel={titleLabel}>
          <Text style={themeStyles.sidebarLinkTextBold}>{titleLabel}</Text>
          <Icon
            src={KirokuIcons.DownArrow}
            fill={theme.icon}
            width={12}
            height={12}
            additionalStyles={[themeStyles.ml1]}
          />
        </PressableWithFeedback>
        {view === 'month' ? (
          <PressableWithFeedback
            disabled={!hasNext}
            onPress={() => setMonthView(addMonths(monthView, 1))}
            hoverDimmingValue={1}
            style={localStyles.headerArrow}
            accessibilityLabel={translate('common.next')}>
            <ArrowIcon disabled={!hasNext} />
          </PressableWithFeedback>
        ) : null}
      </View>

      {view === 'overview' ? (
        <View style={localStyles.overview}>
          <FlashList
            data={years}
            extraData={`${monthView.getFullYear()}-${monthView.getMonth()}`}
            keyExtractor={year => String(year)}
            renderItem={renderYearBlock}
            initialScrollIndex={initialScrollIndex}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
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

          <View style={localStyles.weeks}>
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
                                disabled
                                  ? themeStyles.buttonOpacityDisabled
                                  : {}
                              }
                              color={
                                disabled ? theme.textSupporting : textColor
                              }>
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
        </View>
      )}
    </View>
  );
}

Calendar.displayName = 'Calendar';

export default Calendar;
