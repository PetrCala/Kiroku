import React from 'react';
import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

// One month: a centered month-year header, the 7-column day-name row, and a
// 6×7 day grid — the geometry of the compact `SessionsCalendarView`.
const DAY_COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_ROWS = [0, 1, 2, 3, 4, 5];

/**
 * Layout-faithful placeholder for the embedded *compact* month calendar
 * (e.g. ProfileScreen), shown while the real grid — and its synchronous
 * `useLazyMarkedDates` indexing — is deferred past the navigation slide.
 * Mirrors `SessionsCalendarView`'s header + day-name row + single 6×7 month
 * grid. Sibling to the fullscreen `SessionsCalendarSkeleton`; cells stay static
 * (`animate={false}`) for the same dense-grid reason.
 */
function SessionsCalendarCompactSkeleton() {
  const styles = useThemeStyles();
  const daySize = variables.sessionsCalendarDaySize;
  const dayRadius = variables.componentBorderRadiusNormal;

  return (
    <View
      style={styles.sessionsCalendarContainer}
      testID="SessionsCalendarCompactSkeleton">
      <View style={styles.sessionsCalendarCompactSkeletonHeader}>
        <Skeleton width={120} height={16} radius={3} animate={false} />
      </View>
      <View style={styles.sessionsCalendarDayNamesRow}>
        {DAY_COLUMNS.map(col => (
          <View key={`dn-${col}`} style={styles.sessionsCalendarDayNameCell}>
            <Skeleton width={18} height={10} radius={3} animate={false} />
          </View>
        ))}
      </View>
      {WEEK_ROWS.map(week => (
        <View key={`wk-${week}`} style={styles.sessionsCalendarWeekRow}>
          {DAY_COLUMNS.map(col => (
            <View
              key={`c-${week}-${col}`}
              style={styles.sessionsCalendarWeekCell}>
              <Skeleton
                width={daySize}
                height={daySize}
                radius={dayRadius}
                animate={false}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

SessionsCalendarCompactSkeleton.displayName = 'SessionsCalendarCompactSkeleton';
export default SessionsCalendarCompactSkeleton;
