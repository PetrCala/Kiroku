import React from 'react';
import {StyleSheet, View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

// 7 day-name columns and a couple of month sections of ~6 week rows each —
// enough to fill the viewport so the loading state reads as a calendar rather
// than a blank spinner. Value arrays (not map indexes) keep the keys lint-clean.
const DAY_COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_ROWS = [0, 1, 2, 3, 4, 5];
const MONTH_SECTIONS = [0, 1];

const internalStyles = StyleSheet.create({
  // Mirrors `variables.sessionColorMarkerSize` (20) — the day cell's marker.
  dayCell: {width: 20, height: 20, borderRadius: 6},
  dayNamePlaceholder: {width: 18, height: 10, borderRadius: 3},
  monthLabelPlaceholder: {width: 96, height: 11, borderRadius: 3},
});

/**
 * Layout-faithful placeholder for the fullscreen sessions calendar, shown
 * while the week-list mounts and applies its initial scroll. Mirrors the
 * day-name header + month-label + 7-column week-row geometry so the swap to
 * the real grid is visually quiet — the same match-the-destination strategy
 * as `DayOverviewSkeleton` / `StatisticsScreenSkeleton`.
 */
function SessionsCalendarSkeleton() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const block = {backgroundColor: theme.highlightBG};

  return (
    <View
      style={[styles.flex1, {backgroundColor: theme.appBG}]}
      testID="SessionsCalendarSkeleton">
      <View style={styles.sessionsCalendarDayNamesRow}>
        {DAY_COLUMNS.map(col => (
          <View key={`dn-${col}`} style={styles.sessionsCalendarDayNameCell}>
            <View style={[internalStyles.dayNamePlaceholder, block]} />
          </View>
        ))}
      </View>
      {MONTH_SECTIONS.map(section => (
        <View key={`sec-${section}`}>
          <View style={styles.sessionsCalendarMonthLabel}>
            <View style={[internalStyles.monthLabelPlaceholder, block]} />
            <View style={styles.sessionsCalendarMonthLabelRule} />
          </View>
          {WEEK_ROWS.map(week => (
            <View
              key={`wk-${section}-${week}`}
              style={styles.sessionsCalendarWeekRow}>
              {DAY_COLUMNS.map(col => (
                <View
                  key={`c-${section}-${week}-${col}`}
                  style={styles.sessionsCalendarWeekCell}>
                  <View style={[internalStyles.dayCell, block]} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

SessionsCalendarSkeleton.displayName = 'SessionsCalendarSkeleton';
export default SessionsCalendarSkeleton;
