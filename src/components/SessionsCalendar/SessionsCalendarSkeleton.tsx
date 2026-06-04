import React from 'react';
import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

// 7 day-name columns and a couple of month sections of ~6 week rows each —
// enough to fill the viewport so the loading state reads as a calendar rather
// than a blank spinner. Value arrays (not map indexes) keep the keys lint-clean.
const DAY_COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_ROWS = [0, 1, 2, 3, 4, 5];
const MONTH_SECTIONS = [0, 1];

/**
 * Layout-faithful placeholder for the fullscreen sessions calendar, shown
 * while the week-list mounts and applies its initial scroll. Mirrors the
 * day-name header + month-label + 7-column week-row geometry so the swap to
 * the real grid is visually quiet — the same match-the-destination strategy
 * as `DayOverviewSkeleton` / `StatisticsScreenSkeleton`.
 *
 * Cells use the shared `Skeleton` primitive but stay static (`animate={false}`):
 * this is a dense grid (up to ~84 day markers) and mounting that many
 * simultaneous shimmer animations on the navigation transition would risk jank.
 */
function SessionsCalendarSkeleton() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const daySize = variables.sessionsCalendarDaySize;
  const dayRadius = variables.componentBorderRadiusNormal;

  return (
    <View
      style={[styles.flex1, {backgroundColor: theme.appBG}]}
      testID="SessionsCalendarSkeleton">
      <View style={styles.sessionsCalendarDayNamesRow}>
        {DAY_COLUMNS.map(col => (
          <View key={`dn-${col}`} style={styles.sessionsCalendarDayNameCell}>
            <Skeleton width={18} height={10} radius={3} animate={false} />
          </View>
        ))}
      </View>
      {MONTH_SECTIONS.map(section => (
        <View key={`sec-${section}`}>
          <View style={styles.sessionsCalendarMonthLabel}>
            <Skeleton width={96} height={11} radius={3} animate={false} />
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
      ))}
    </View>
  );
}

SessionsCalendarSkeleton.displayName = 'SessionsCalendarSkeleton';
export default SessionsCalendarSkeleton;
