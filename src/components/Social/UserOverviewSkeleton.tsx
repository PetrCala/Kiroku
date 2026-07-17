import React from 'react';
import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';

/**
 * Placeholder friend row for the list's cold load, mirroring `UserOverview`
 * geometry (same container padding, avatar circle, name bar on the left,
 * status block on the right) so the swap to real rows causes no layout shift.
 */
function UserOverviewSkeleton() {
  const styles = useThemeStyles();
  return (
    <View style={styles.userOverviewContainer}>
      <View style={styles.userOverviewLeftContent}>
        <Skeleton height={variables.avatarSizeLarge} circle />
        <Skeleton width={140} height={16} style={styles.ml3} />
      </View>
      <View
        style={[
          styles.flexColumn,
          styles.justifyContentCenter,
          styles.alignItemsCenter,
        ]}>
        <Skeleton width={64} height={12} />
        <Skeleton width={44} height={12} style={styles.mt1} />
      </View>
    </View>
  );
}

UserOverviewSkeleton.displayName = 'UserOverviewSkeleton';

export default UserOverviewSkeleton;
