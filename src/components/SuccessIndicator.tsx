import React, {useState, useEffect} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {Animated} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';

type SuccessIndicatorProps = {
  /** Whether the indicator is visible */
  visible: boolean;

  /** Additional styles for the success indicator */
  style?: StyleProp<ViewStyle>;
};

function SuccessIndicator({visible, style}: SuccessIndicatorProps) {
  const [opacity] = useState(new Animated.Value(0)); // Initial value for opacity: 0
  const styles = useThemeStyles();

  useEffect(() => {
    if (!visible) {
      return;
    }
    // Fade in the indicator
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // After fading in, wait for 1 second, then fade out
      setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 1000);
    });
  }, [visible, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.successIndicator,
        {backgroundColor: 'green'}, // TODO replace with theme color
        style,
        {opacity},
      ]}
    />
  );
}

export default SuccessIndicator;
