import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import Icon from './Icon';
import Text from './Text';

type OfflineIndicatorProps = {
  /** Additional styles for the container */
  style?: StyleProp<ViewStyle>;
};

function OfflineIndicator({style}: OfflineIndicatorProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {isOffline} = useNetwork();

  if (!isOffline) {
    return null;
  }

  return (
    <View
      style={[
        styles.offlineIndicatorContainer,
        styles.flexRow,
        styles.alignItemsCenter,
        style,
      ]}>
      <Icon
        fill={theme.icon}
        src={KirokuIcons.OfflineCloud}
        width={variables.iconSizeSmall}
        height={variables.iconSizeSmall}
      />
      <Text style={[styles.ml3, styles.textMicroSupporting]}>
        {translate('common.youAppearToBeOffline')}
      </Text>
    </View>
  );
}

OfflineIndicator.displayName = 'OfflineIndicator';

export default OfflineIndicator;
