import React, {memo} from 'react';
import {View} from 'react-native';
import {parseISO} from 'date-fns';
import type {DateData} from 'react-native-calendars';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import useThemeStyles from '@hooks/useThemeStyles';
import DayComponent from './DayComponent';
import type {MonthWeek} from './buildMonthSections';
import type {DayCellData} from './deriveCalendarMonth';

type WeekRowProps = {
  row: MonthWeek;
  /** Per-day cell payload for the row's month (marking + units). Month-scoped
   *  and referentially stable across loaded-window widens, which is what lets
   *  this component's `memo` hold while older months stream in. */
  dayData: ReadonlyMap<DateString, DayCellData>;
  /** Earliest tracked day ('yyyy-MM-dd'). Days before it render dimmed but stay
   *  clickable. Styling-only. */
  trackingStartDate?: string;
  onDayPress?: (day: DateData) => void;
  onDayLongPress?: (day: DateData) => void;
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
function WeekRow({
  row,
  dayData,
  trackingStartDate,
  onDayPress,
  onDayLongPress,
}: WeekRowProps) {
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
        const cell = dayData.get(dayKey);
        return (
          <View key={dayKey} style={styles.sessionsCalendarWeekCell}>
            <DayComponent
              date={dayKeyToDateData(dayKey)}
              units={cell?.units}
              marking={cell?.marking}
              trackingStartDate={trackingStartDate}
              onPress={onDayPress}
              onLongPress={onDayLongPress}
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
