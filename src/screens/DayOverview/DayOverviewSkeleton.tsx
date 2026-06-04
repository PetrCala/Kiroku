import React from 'react';
import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

// One placeholder day section: a day-header row (date + units) followed by a
// couple of session-tile placeholders (~84px, matching DrinkingSessionOverview).
const SESSIONS_PER_DAY = [0, 1] as const;
const DAY_SECTIONS = [0, 1] as const;

function DayOverviewSkeleton() {
  const styles = useThemeStyles();
  const theme = useTheme();

  return (
    <View
      style={[styles.flex1, styles.ph2, {backgroundColor: theme.appBG}]}
      testID="DayOverviewSkeleton">
      {DAY_SECTIONS.map(section => (
        <View key={`section-${section}`}>
          {/* Day header — mirrors sessionsCalendarMonthLabel (date + rule + units) */}
          <View style={styles.sessionsCalendarMonthLabel}>
            <Skeleton width={110} height={14} />
            <View style={[styles.sessionsCalendarMonthLabelRule, styles.mh2]} />
            <Skeleton width={60} height={14} />
          </View>
          {/* Session tiles — match the ~84px tile rows */}
          {SESSIONS_PER_DAY.map(tile => (
            <View
              key={`tile-${section}-${tile}`}
              style={[
                styles.mh1,
                styles.mb2,
                styles.p4,
                styles.justifyContentCenter,
                {minHeight: 84, borderRadius: 8, backgroundColor: theme.cardBG},
              ]}>
              <Skeleton width={90} height={16} />
              <Skeleton width={140} height={12} style={styles.mt2} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

DayOverviewSkeleton.displayName = 'DayOverviewSkeleton';
export default DayOverviewSkeleton;
