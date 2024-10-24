import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type FullScreenLoadingIndicatorProps = {
  style?: StyleProp<ViewStyle>;
  loadingText?: string;
};

function FullScreenLoadingIndicator({
  loadingText,
  style,
}: FullScreenLoadingIndicatorProps) {
  const theme = useTheme();
  const styles = useThemeStyles();

  return (
    <View
      style={[StyleSheet.absoluteFillObject, styles.fullScreenLoading, style]}>
      {loadingText && (
        <Text style={[styles.textLoading, styles.mb4]}>{loadingText}</Text>
      )}
      <ActivityIndicator
        color={theme.spinner}
        size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
      />
    </View>
  );
}

FullScreenLoadingIndicator.displayName = 'FullScreenLoadingIndicator';

export default FullScreenLoadingIndicator;
