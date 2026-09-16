import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import type {MonthWeek} from './buildMonthSections';

const internalStyles = StyleSheet.create({
  tile: {
    width: variables.sessionsCalendarDaySize,
    height: variables.sessionsCalendarDaySize,
    borderRadius: variables.sessionsCalendarTileRadius,
  },
});

type WeekRowSkeletonProps = {
  /** The week-row geometry to mirror — blank cells stay blank so the skeleton
   *  is shaped exactly like the real row that will replace it. */
  row: MonthWeek;
};

/**
 * Placeholder week row shown while a month's data is still on its way
 * (the "pending" zone above the loaded floor in the fullscreen calendar).
 * Pixel-identical geometry to `WeekRow` — same row/cell styles, same 44×44
 * day tiles — so the in-place swap to real data causes no layout shift.
 *
 * Tiles are plain views, not the SVG-backed `Skeleton` primitive: the rows are
 * static anyway (the `SessionsCalendarSkeleton` precedent), and FlashList
 * recycles them on every scroll, where seven SVG content loaders per row were
 * a measurable mount cost. Cells are keyed by column so a recycled row updates
 * its tiles in place instead of remounting them.
 */
function WeekRowSkeleton({row}: WeekRowSkeletonProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  return (
    <View style={styles.sessionsCalendarWeekRow}>
      {row.days.map((dayKey, idx) => (
        <View
          // Index is stable within a row of fixed width 7.
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          style={
            dayKey
              ? styles.sessionsCalendarWeekCell
              : styles.sessionsCalendarWeekCellBlank
          }>
          {dayKey ? (
            <View
              style={[
                internalStyles.tile,
                {backgroundColor: theme.skeletonBase},
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

WeekRowSkeleton.displayName = 'WeekRowSkeleton';
export default memo(WeekRowSkeleton);
export type {WeekRowSkeletonProps};
