import React from 'react';
import {StyleSheet, View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

// One month: a centered month-year header, the 7-column day-name row, and a
// 6×7 day grid — the geometry of the compact `SessionsCalendarView`.
const DAY_COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_ROWS = [0, 1, 2, 3, 4, 5];

const internalStyles = StyleSheet.create({
  header: {paddingVertical: 10, alignItems: 'center', justifyContent: 'center'},
  monthLabelPlaceholder: {width: 120, height: 16, borderRadius: 3},
  dayNamePlaceholder: {width: 18, height: 10, borderRadius: 3},
  // Matches the real day cell (`getSessionsCalendarDayCellStyle`) so the swap to
  // the live grid doesn't shift the surrounding scroll content.
  dayCell: {
    width: variables.sessionsCalendarDaySize,
    height: variables.sessionsCalendarDaySize,
    borderRadius: variables.componentBorderRadiusNormal,
  },
});

/**
 * Layout-faithful placeholder for the embedded *compact* month calendar
 * (e.g. ProfileScreen), shown while the real grid — and its synchronous
 * `useLazyMarkedDates` indexing — is deferred past the navigation slide.
 * Mirrors `SessionsCalendarView`'s header + day-name row + single 6×7 month
 * grid. Sibling to the fullscreen `SessionsCalendarSkeleton`.
 */
function SessionsCalendarCompactSkeleton() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const block = {backgroundColor: theme.highlightBG};

  return (
    <View
      style={styles.sessionsCalendarContainer}
      testID="SessionsCalendarCompactSkeleton">
      <View style={internalStyles.header}>
        <View style={[internalStyles.monthLabelPlaceholder, block]} />
      </View>
      <View style={styles.sessionsCalendarDayNamesRow}>
        {DAY_COLUMNS.map(col => (
          <View key={`dn-${col}`} style={styles.sessionsCalendarDayNameCell}>
            <View style={[internalStyles.dayNamePlaceholder, block]} />
          </View>
        ))}
      </View>
      {WEEK_ROWS.map(week => (
        <View key={`wk-${week}`} style={styles.sessionsCalendarWeekRow}>
          {DAY_COLUMNS.map(col => (
            <View
              key={`c-${week}-${col}`}
              style={styles.sessionsCalendarWeekCell}>
              <View style={[internalStyles.dayCell, block]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

SessionsCalendarCompactSkeleton.displayName = 'SessionsCalendarCompactSkeleton';
export default SessionsCalendarCompactSkeleton;
