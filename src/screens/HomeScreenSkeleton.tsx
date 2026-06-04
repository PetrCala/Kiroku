import React from 'react';
import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

/** Placeholder for the home-screen header (profile avatar + display name). */
function HomeHeaderSkeleton() {
  const styles = useThemeStyles();
  const avatarSize = variables.avatarSizeMedium;
  return (
    <View
      style={[
        styles.headerBar,
        styles.borderBottom,
        styles.flexRow,
        styles.alignItemsCenter,
        styles.ph2,
      ]}>
      <Skeleton circle height={avatarSize} />
      <Skeleton width={140} height={16} style={styles.ml3} />
    </View>
  );
}

/** Placeholder for the two stat cards (sessions + units this month). */
function StatOverviewSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={styles.statOverviewContainer}>
      {['sessions', 'units'].map(slot => (
        <View
          key={slot}
          style={[
            styles.flexColumn,
            styles.alignItemsCenter,
            styles.justifyContentCenter,
          ]}>
          {/* Matches fontSizeXXXXLarge (36px) bold value text */}
          <Skeleton width={72} height={44} style={styles.mb2} />
          {/* Matches fontSizeNormal (15px) label, 2 lines, max-width 150 */}
          <Skeleton width={130} height={36} />
        </View>
      ))}
    </View>
  );
}

// react-native-calendars renders 6 week rows for most months (some months span
// 6 partial weeks). Matching 6 here keeps the skeleton from being shorter than
// the calendar that swaps in, which would otherwise jolt the layout down.
const CALENDAR_WEEKS = [0, 1, 2, 3, 4, 5] as const;
const CALENDAR_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Placeholder for the sessions calendar matching react-native-calendars layout. */
function SessionsCalendarSkeleton() {
  const styles = useThemeStyles();
  const daySize = variables.sessionsCalendarDaySize;
  const dayRadius = variables.componentBorderRadiusNormal;
  return (
    <View style={styles.sessionsCalendarContainer}>
      {/* Month header — matches the custom renderHeader in SessionsCalendarView
       *  (single centered text, no nav arrows). */}
      <View style={[styles.sessionsCalendarHeader, styles.pv3]}>
        <Skeleton width={100} height={18} animate={false} />
      </View>
      {/* Day-name row — matches the library's `stylesheet.calendar.header`
       *  spacing (marginTop:7 on the week, marginBottom:7 on each dayHeader). */}
      <View
        style={[
          styles.flexRow,
          styles.justifyContentAround,
          styles.mt2,
          styles.mb2,
        ]}>
        {CALENDAR_DAYS.map(day => (
          <View
            key={`name-${day}`}
            style={[styles.flex1, styles.alignItemsCenter]}>
            <Skeleton width={20} height={12} animate={false} />
          </View>
        ))}
      </View>
      {/* Week rows — each cell mirrors the real DayComponent: a single
       *  heatmap-tile square sized via variables.sessionsCalendarDaySize.
       *  marginVertical:6 matches stylesheet.calendar.main.week in
       *  getSessionsCalendarStyle, so swap-in lands at the same Y. Dense grid,
       *  so cells stay static (animate={false}) — see the Skeleton primitive. */}
      {CALENDAR_WEEKS.map(week => (
        <View
          key={`week-${week}`}
          style={[
            styles.flexRow,
            styles.justifyContentAround,
            {marginVertical: 6},
          ]}>
          {CALENDAR_DAYS.map(day => (
            <Skeleton
              key={`day-${week}-${day}`}
              width={daySize}
              height={daySize}
              radius={dayRadius}
              animate={false}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export {HomeHeaderSkeleton, StatOverviewSkeleton, SessionsCalendarSkeleton};
