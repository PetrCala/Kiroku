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
 * Placeholder for the consolidated "This month" overview card (title row +
 * three stat columns). Height + margin mirror MonthlyOverviewCard so the
 * swap-in doesn't jolt the layout.
 */
function StatOverviewSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={styles.mv2}>
      <Skeleton height={110} radius={12} />
    </View>
  );
}

export {HomeHeaderSkeleton, StatOverviewSkeleton};
