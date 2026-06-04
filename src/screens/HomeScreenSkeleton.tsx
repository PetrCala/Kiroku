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

export {HomeHeaderSkeleton, StatOverviewSkeleton};
