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
        // DEBUG pink: HomeHeaderSkeleton headerBar
        {borderBottomWidth: 1, borderColor: '#FF0090'},
        styles.ph2,
      ]}>
      <View style={[styles.flexRow, styles.alignItemsCenter]}>
        <Skeleton circle height={avatarSize} />
        <Skeleton width={140} height={16} style={styles.ml3} />
      </View>
    </View>
  );
}

export default HomeHeaderSkeleton;
