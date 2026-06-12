import React, {memo} from 'react';
import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import type {MonthWeek} from './buildMonthSections';

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
 * Static cells (`animate={false}`): many of these mount at once during a
 * fast scroll, matching the `SessionsCalendarSkeleton` precedent.
 */
function WeekRowSkeleton({row}: WeekRowSkeletonProps) {
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
        return (
          <View key={dayKey} style={styles.sessionsCalendarWeekCell}>
            <Skeleton
              width={variables.sessionsCalendarDaySize}
              height={variables.sessionsCalendarDaySize}
              radius={variables.componentBorderRadiusNormal}
              animate={false}
            />
          </View>
        );
      })}
    </View>
  );
}

WeekRowSkeleton.displayName = 'WeekRowSkeleton';
export default memo(WeekRowSkeleton);
export type {WeekRowSkeletonProps};
