import React, {useMemo} from 'react';
import {View} from 'react-native';
import {getDay, getDaysInMonth, startOfMonth} from 'date-fns';
import Skeleton from '@components/Skeleton';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import CONST from '@src/CONST';

const DAY_COLUMNS = [0, 1, 2, 3, 4, 5, 6];
const NAV_BUTTONS = [0, 1];

// react-native-calendars renders only the weeks that touch the visible month
// (no forced six-week grid), so the compact calendar's height varies month to
// month. The compact skeleton always stands in for the *current* month, so we
// derive the same row count here — matching the grid that swaps in and avoiding
// a vertical jolt on the handover.
function getWeekRowCount(date: Date): number {
  const offset = (getDay(startOfMonth(date)) - CONST.WEEK_STARTS_ON + 7) % 7;
  return Math.ceil((offset + getDaysInMonth(date)) / 7);
}

/**
 * Layout-faithful placeholder for the embedded *compact* month calendar
 * (Home / Profile), shown while the real grid — and its synchronous
 * `useLazyMarkedDates` indexing — is deferred past the navigation slide.
 *
 * Mirrors `SessionsCalendarView`'s geometry so the swap is visually quiet:
 * the `componentBG` body, the custom month-header row (month label leading,
 * two round nav buttons trailing, `marginTop:6`, 48px tall), the borderless
 * day-name strip (`marginTop:7`), and the variable-height 7×N day grid. Sibling to the fullscreen
 * `SessionsCalendarSkeleton`; cells stay static (`animate={false}`) on this
 * dense grid for the same anti-jank reason.
 */
function SessionsCalendarCompactSkeleton() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const daySize = variables.sessionsCalendarDaySize;
  const dayRadius = variables.sessionsCalendarTileRadius;
  const weekRows = useMemo(() => {
    const count = getWeekRowCount(new Date());
    return Array.from({length: count}, (_, i) => i);
  }, []);

  return (
    <View
      style={[
        styles.sessionsCalendarContainer,
        {backgroundColor: theme.componentBG},
      ]}
      testID="SessionsCalendarCompactSkeleton">
      <View style={styles.sessionsCalendarCompactSkeletonHeader}>
        <Skeleton width={78} height={18} radius={3} animate={false} />
        <View style={styles.flex1} />
        {NAV_BUTTONS.map(button => (
          <View
            key={`nav-${button}`}
            style={styles.sessionsCalendarCompactSkeletonNavButton}>
            <Skeleton
              width={variables.periodHeaderNavButtonSize}
              height={variables.periodHeaderNavButtonSize}
              radius={variables.periodHeaderNavButtonSize / 2}
              animate={false}
            />
          </View>
        ))}
      </View>
      <View style={styles.sessionsCalendarCompactSkeletonDayNamesRow}>
        {DAY_COLUMNS.map(col => (
          <View
            key={`dn-${col}`}
            style={styles.sessionsCalendarCompactSkeletonDayNameCell}>
            <Skeleton width={24} height={12} radius={3} animate={false} />
          </View>
        ))}
      </View>
      {weekRows.map(week => (
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
