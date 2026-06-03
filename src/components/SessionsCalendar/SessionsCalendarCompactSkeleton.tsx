import React from 'react';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';

// One month: a centered month-year header, the 7-column day-name row, and a
// 6×7 day grid — the geometry of the compact `SessionsCalendarView`.
const DAY_COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_ROWS = [0, 1, 2, 3, 4, 5];

/**
 * Layout-faithful placeholder for the embedded *compact* month calendar
 * (e.g. ProfileScreen), shown while the real grid — and its synchronous
 * `useLazyMarkedDates` indexing — is deferred past the navigation slide.
 * Mirrors `SessionsCalendarView`'s header + day-name row + single 6×7 month
 * grid. Sibling to the fullscreen `SessionsCalendarSkeleton`.
 */
function SessionsCalendarCompactSkeleton() {
  const styles = useThemeStyles();

  return (
    <View
      style={styles.sessionsCalendarContainer}
      testID="SessionsCalendarCompactSkeleton">
      <View style={styles.sessionsCalendarCompactSkeletonHeader}>
        <View style={styles.sessionsCalendarCompactSkeletonMonthLabel} />
      </View>
      <View style={styles.sessionsCalendarDayNamesRow}>
        {DAY_COLUMNS.map(col => (
          <View key={`dn-${col}`} style={styles.sessionsCalendarDayNameCell}>
            <View style={styles.sessionsCalendarCompactSkeletonDayName} />
          </View>
        ))}
      </View>
      {WEEK_ROWS.map(week => (
        <View key={`wk-${week}`} style={styles.sessionsCalendarWeekRow}>
          {DAY_COLUMNS.map(col => (
            <View
              key={`c-${week}-${col}`}
              style={styles.sessionsCalendarWeekCell}>
              <View style={styles.sessionsCalendarCompactSkeletonDayCell} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

SessionsCalendarCompactSkeleton.displayName = 'SessionsCalendarCompactSkeleton';
export default SessionsCalendarCompactSkeleton;
