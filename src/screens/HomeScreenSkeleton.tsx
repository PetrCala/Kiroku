import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

type BlockProps = {
  width: number;
  height: number;
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
        styles.pl5,
      ]}>
      <Block width={avatarSize} height={avatarSize} radius={avatarSize / 2} />
      <Block width={140} height={16} style={styles.ml3} />
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
          <Block width={72} height={44} style={styles.mb2} />
          {/* Matches fontSizeNormal (15px) label, 2 lines, max-width 150 */}
          <Block width={130} height={36} />
        </View>
      ))}
    </View>
  );
}

const CALENDAR_WEEKS = [0, 1, 2, 3, 4] as const;
const CALENDAR_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Placeholder for the sessions calendar matching react-native-calendars layout. */
function SessionsCalendarSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={[styles.sessionsCalendarContainer, styles.p4]}>
      {/* Month header: left arrow + month name + right arrow */}
      <View
        style={[
          styles.flexRow,
          styles.alignItemsCenter,
          styles.justifyContentBetween,
          styles.mb3,
        ]}>
        <Block width={24} height={24} radius={4} />
        <Block width={100} height={18} />
        <Block width={24} height={24} radius={4} />
      </View>
      {/* Day-name row (Mon Tue Wed …) */}
      <View style={[styles.flexRow, styles.justifyContentBetween, styles.mb3]}>
        {CALENDAR_DAYS.map(day => (
          <Block key={`name-${day}`} width={20} height={12} />
        ))}
      </View>
      {/* Week rows — each cell mirrors DayComponent: day number + marking box */}
      {CALENDAR_WEEKS.map(week => (
        <View
          key={`week-${week}`}
          style={[styles.flexRow, styles.justifyContentBetween, styles.mb3]}>
          {CALENDAR_DAYS.map(day => (
            <View
              key={`day-${week}-${day}`}
              style={[styles.flexColumn, styles.alignItemsCenter]}>
              <Block width={16} height={12} style={styles.mb1} />
              <Block width={28} height={28} radius={4} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export {HomeHeaderSkeleton, StatOverviewSkeleton, SessionsCalendarSkeleton};
