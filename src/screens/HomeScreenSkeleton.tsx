import React from 'react';
import type {DimensionValue, StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

type BlockProps = {
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

function Block({width, height, radius = 6, style}: BlockProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.highlightBG,
        },
        style,
      ]}
    />
  );
}

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
      <Block width={avatarSize} height={avatarSize} radius={avatarSize / 2} />
      <Block width={140} height={16} style={styles.ml3} />
    </View>
  );
}

/**
 * Placeholder for the home stats block: a "Units" hero card (label + value +
 * delta + drink-type breakdown) over a pair of supporting cards. Heights
 * mirror HomeStatsOverview so the swap-in doesn't jolt the layout.
 */
function StatOverviewSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={styles.mt2}>
      {/* Hero card (KpiCard + DrinkBreakdown). */}
      <Block width="100%" height={130} radius={12} style={styles.mb2} />
      {/* Supporting pair (sessions + alcohol-free). */}
      <View style={styles.flexRow}>
        <Block
          width="100%"
          height={96}
          radius={12}
          style={[styles.flex1, styles.mr1]}
        />
        <Block
          width="100%"
          height={96}
          radius={12}
          style={[styles.flex1, styles.ml1]}
        />
      </View>
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
        <Block width={100} height={18} />
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
            <Block width={20} height={12} />
          </View>
        ))}
      </View>
      {/* Week rows — each cell mirrors the real DayComponent: a single
       *  heatmap-tile square sized via variables.sessionsCalendarDaySize.
       *  marginVertical:6 matches stylesheet.calendar.main.week in
       *  getSessionsCalendarStyle, so swap-in lands at the same Y. */}
      {CALENDAR_WEEKS.map(week => (
        <View
          key={`week-${week}`}
          style={[
            styles.flexRow,
            styles.justifyContentAround,
            {marginVertical: 6},
          ]}>
          {CALENDAR_DAYS.map(day => (
            <Block
              key={`day-${week}-${day}`}
              width={daySize}
              height={daySize}
              radius={dayRadius}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export {HomeHeaderSkeleton, StatOverviewSkeleton, SessionsCalendarSkeleton};
