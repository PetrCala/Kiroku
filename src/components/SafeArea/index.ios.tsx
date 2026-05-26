import React from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import useThemeStyles from '@hooks/useThemeStyles';
import type SafeAreaProps from './types';

function SafeArea({children}: SafeAreaProps) {
  const styles = useThemeStyles();
  // DIAGNOSTIC — DO NOT MERGE
  // Color-tag iPhoneXSafeArea (normally theme.inverse) so a residual
  // cold-start flash can identify its source. Magenta = SafeAreaView.
  return (
    <SafeAreaView
      style={[styles.iPhoneXSafeArea, {backgroundColor: '#FF00FF'}]}
      edges={['left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

SafeArea.displayName = 'SafeArea';

export default SafeArea;
