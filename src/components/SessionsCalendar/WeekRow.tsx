import React, {memo} from 'react';
// The fullscreen calendar recycles these rows on every scroll frame, so each
// cell must stay as light as a pressable tile can be. `PressableWithFeedback`
// wraps every cell in a Reanimated opacity view plus GenericPressable's hook
// stack (screen-reader listener, keyboard-shortcut effect, single-execution
// state, auto hit-slop) and the `Text` wrapper re-flattens styles per render;
// profiled, that machinery was most of the JS time of a fast fling. The raw
// primitives below give the same tile, press dim, testIDs and a11y role.
// eslint-disable-next-line no-restricted-imports
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {PressableStateCallbackType} from 'react-native';
import type {DateData} from 'react-native-calendars';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import HapticFeedback from '@libs/HapticFeedback';
import FontUtils from '@styles/utils/FontUtils';
import variables from '@styles/variables';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type {MonthWeek} from './buildMonthSections';
import type {DayCellData} from './deriveCalendarMonth';

type ThemeStyles = ReturnType<typeof useThemeStyles>;
type StyleUtils = ReturnType<typeof useStyleUtils>;

const internalStyles = StyleSheet.create({
  // What `@components/Text` applies on top of a caller's style: the app font
  // and, for the normal size, its matching line height.
  text: {...FontUtils.fontFamily.platform.EXP_NEUE},
  unitsText: {lineHeight: variables.fontSizeNormalHeight},
  // Same press dim as `PressableWithFeedback`, applied by the pressable's own
  // state instead of a per-cell animated opacity.
  pressed: {opacity: variables.pressDimValue},
});

const pressableStyle = ({pressed}: PressableStateCallbackType) =>
  pressed ? internalStyles.pressed : undefined;

/** Press payload, built only when a cell is actually pressed. */
function dayKeyToDateData(key: DateString): DateData {
  const [year, month, day] = key.split('-').map(Number);
  return {
    dateString: key,
    day,
    month,
    year,
    timestamp: new Date(year, month - 1, day).getTime(),
  };
}

type WeekDayCellProps = {
  /** The cell's day ('yyyy-MM-dd'), or null for a blank cell outside the
   *  month / loaded range. */
  dayKey: DateString | null;
  /** Marking + units for the day; undefined for days without derived data
   *  (pre-tracking months). */
  cell: DayCellData | undefined;
  /** Whether the day precedes the user's tracking start: drawn dimmed, still
   *  pressable so a past session can be added. */
  isBeforeTracking: boolean;
  onDayPress?: (day: DateData) => void;
  onDayLongPress?: (day: DateData) => void;
  styles: ThemeStyles;
  StyleUtils: StyleUtils;
};

/**
 * One day tile of the week-list. Mirrors `DayComponent` (the compact grid's
 * cell) visually: same tile/label/units styles, same `calendar-day-<date>`
 * testID on the pressable and `-has-sessions` on its wrapper for days with
 * data. The fullscreen list never renders future days, so there is no disabled
 * state, and it never marks today (see `WeekRow`).
 */
function WeekDayCellInner({
  dayKey,
  cell,
  isBeforeTracking,
  onDayPress,
  onDayLongPress,
  styles,
  StyleUtils,
}: WeekDayCellProps) {
  if (!dayKey) {
    return <View style={styles.sessionsCalendarWeekCellBlank} />;
  }
  const marking = cell?.marking;
  const units = cell?.units;
  const unitsText =
    !isBeforeTracking && units !== undefined && units > 0
      ? (Number.isInteger(units) ? units : units.toFixed(1)).toString()
      : '';
  return (
    <View
      style={styles.sessionsCalendarWeekCell}
      // Present only on days that hold sessions (`units` is populated per day
      // only where sessions exist), so UI tests can find a day with data.
      testID={
        units !== undefined ? `calendar-day-${dayKey}-has-sessions` : undefined
      }>
      <Pressable
        testID={`calendar-day-${dayKey}`}
        accessibilityRole="button"
        style={pressableStyle}
        onPress={() => onDayPress?.(dayKeyToDateData(dayKey))}
        onLongPress={
          onDayLongPress
            ? () => {
                // `GenericPressable` fires this haptic for any long press.
                HapticFeedback.longPress();
                onDayLongPress(dayKeyToDateData(dayKey));
              }
            : undefined
        }>
        <View
          style={StyleUtils.getSessionsCalendarDayCellStyle(
            marking,
            isBeforeTracking,
          )}>
          <Text
            allowFontScaling={false}
            style={[
              internalStyles.text,
              StyleUtils.getSessionsCalendarDayLabelStyle(
                marking,
                isBeforeTracking,
              ),
            ]}>
            {Number(dayKey.slice(8, 10))}
          </Text>
          {unitsText !== '' && (
            <Text
              allowFontScaling={false}
              style={[
                internalStyles.text,
                internalStyles.unitsText,
                StyleUtils.getSessionsCalendarDayUnitsTextStyle(marking),
              ]}>
              {unitsText}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

WeekDayCellInner.displayName = 'WeekDayCell';
const WeekDayCell = memo(WeekDayCellInner);

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

/**
 * One row of the continuous week-list: seven `WeekDayCell`s laid out with
 * `flex: 1` so the row stretches across the available width.
 *
 * Cells are keyed by column, not by date. FlashList recycles a row by handing
 * it a different week, and a date key would make React unmount and remount
 * all seven cells on every recycle; a column key turns that into an in-place
 * prop update.
 *
 * Note: today is intentionally not marked here. In the fullscreen view, today
 * is always the bottom-most rendered tile (tomorrow's cell is never rendered),
 * so the rim highlight the compact calendar draws for "today" would be
 * redundant chrome.
 */
function WeekRow({
  row,
  dayData,
  trackingStartDate,
  onDayPress,
  onDayLongPress,
}: WeekRowProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  return (
    <View style={styles.sessionsCalendarWeekRow}>
      {row.days.map((dayKey, idx) => (
        <WeekDayCell
          // Index is stable within a row of fixed width 7 (see above).
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          dayKey={dayKey}
          cell={dayKey ? dayData.get(dayKey) : undefined}
          isBeforeTracking={
            !!dayKey && !!trackingStartDate && dayKey < trackingStartDate
          }
          onDayPress={onDayPress}
          onDayLongPress={onDayLongPress}
          styles={styles}
          StyleUtils={StyleUtils}
        />
      ))}
    </View>
  );
}

WeekRow.displayName = 'WeekRow';
export default memo(WeekRow);
export type {WeekRowProps};
