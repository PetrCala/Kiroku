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
          <Block width={56} height={28} style={styles.mb2} />
          <Block width={96} height={12} />
        </View>
      ))}
    </View>
  );
}

const CALENDAR_WEEKS = [0, 1, 2, 3, 4, 5] as const;
const CALENDAR_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Placeholder for the sessions calendar (rough 6×7 day grid). */
function SessionsCalendarSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={[styles.sessionsCalendarContainer, styles.p4]}>
      {CALENDAR_WEEKS.map(week => (
        <View
          key={`week-${week}`}
          style={[styles.flexRow, styles.justifyContentBetween, styles.mb3]}>
          {CALENDAR_DAYS.map(day => (
            <Block
              key={`day-${week}-${day}`}
              width={32}
              height={32}
              radius={16}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export {HomeHeaderSkeleton, StatOverviewSkeleton, SessionsCalendarSkeleton};
