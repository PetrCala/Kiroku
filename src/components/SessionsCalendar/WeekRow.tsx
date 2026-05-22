import React, {memo} from 'react';
import {View} from 'react-native';
import {parseISO} from 'date-fns';
import type {DateData} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import type {MarkingProps} from 'react-native-calendars/src/calendar/day/marking';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import useThemeStyles from '@hooks/useThemeStyles';
import DayComponent from './DayComponent';
import type {MonthWeek} from './buildMonthSections';

type WeekRowProps = {
  row: MonthWeek;
  markedDates: MarkedDates;
  unitsMap: Map<DateString, number>;
  onDayPress?: (day: DateData) => void;
};

function dayKeyToDateData(key: DateString): DateData {
  const date = parseISO(key);
  const [year, month, day] = key.split('-').map(Number);
  return {
    dateString: key,
    day,
    month,
    year,
    timestamp: date.getTime(),
  };
}

/**
 * One row of the continuous week-list. Renders seven `DayComponent` cells
 * laid out with `flex: 1` so the row stretches across the available width.
 *
 * Note: we intentionally do not pass `state="today"` to DayComponent here.
 * In the fullscreen view, today is always the bottom-most rendered tile
 * (tomorrow's cell is never rendered), so the rim highlight that DayComponent
 * draws for "today" is redundant chrome. The compact calendar still uses the
 * rim because today can sit anywhere in its fixed month grid.
 */
function WeekRow({row, markedDates, unitsMap, onDayPress}: WeekRowProps) {
  const styles = useThemeStyles();
  return (
    <View style={styles.sessionsCalendarWeekRow}>
      {row.days.map((dayKey, idx) => {
        if (!dayKey) {
          return (
            <View
              // Index is stable within a row of fixed width 7.
              // eslint-disable-next-line react/no-array-index-key
              key={`blank-${row.key}-${idx}`}
              style={styles.sessionsCalendarWeekCellBlank}
            />
          );
        }
        const marking = markedDates[dayKey] as MarkingProps | undefined;
        return (
          <View key={dayKey} style={styles.sessionsCalendarWeekCell}>
            <DayComponent
              date={dayKeyToDateData(dayKey)}
              units={unitsMap.get(dayKey)}
              marking={marking}
              onPress={onDayPress}
            />
          </View>
        );
      })}
    </View>
  );
}

WeekRow.displayName = 'WeekRow';
export default memo(WeekRow);
export type {WeekRowProps};
