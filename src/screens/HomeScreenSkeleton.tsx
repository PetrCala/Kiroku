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
    <View style={[styles.headerBar, styles.borderBottom, styles.ph2]}>
      <View style={[styles.flexRow, styles.alignItemsCenter]}>
        <Skeleton circle height={avatarSize} />
        <Skeleton width={140} height={16} style={styles.ml3} />
      </View>
    </View>
  );
}

/**
 * Placeholder for the home stats block: a tall "Units" hero card (label +
 * value + delta + per-week bar chart) over a pair of supporting cards.
 * Heights mirror MonthlyOverviewCard so the swap-in doesn't jolt the layout.
 */
function StatOverviewSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={styles.mt2}>
      {/* Hero card (KpiCard + "Units by week" caption + horizontal bars). */}
      <Skeleton height={210} radius={12} style={styles.mb2} />
      {/* Supporting pair (sessions + alcohol-free). */}
      <View style={styles.flexRow}>
        <Skeleton height={96} radius={12} style={[styles.flex1, styles.mr1]} />
        <Skeleton height={96} radius={12} style={[styles.flex1, styles.ml1]} />
      </View>
    </View>
  );
}

export {HomeHeaderSkeleton, StatOverviewSkeleton};
