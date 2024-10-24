import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import {ValueOf} from 'type-fest';

type FlexibleLoadingIndicatorProps = {
  style?: StyleProp<ViewStyle>;
  size?: ValueOf<typeof CONST.ACTIVITY_INDICATOR_SIZE>;
};

function FlexibleLoadingIndicator({
  style,
  size,
}: FlexibleLoadingIndicatorProps) {
  const theme = useTheme();
  const styles = useThemeStyles();

  return (
    <ActivityIndicator
      color={theme.spinner}
      style={[styles.flex1, style]}
      size={size || CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
    />
  );
}

FlexibleLoadingIndicator.displayName = 'FlexibleLoadingIndicator';

export default FlexibleLoadingIndicator;
