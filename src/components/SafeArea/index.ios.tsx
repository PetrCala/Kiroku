import React from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {useSplashScreenStateContext} from '@context/global/SplashScreenStateContext';
import CONST from '@src/CONST';
import type SafeAreaProps from './types';

function SafeArea({children}: SafeAreaProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {splashScreenState} = useSplashScreenStateContext();
  // While the splash is up, paint the SafeAreaView's native backing view
  // splashBG yellow instead of theme.inverse. The Kiroku-level guard View
  // covers the content area but the SafeAreaView is the outermost native
  // view inside the React surface — if any layer above it lags first
  // paint, theme.inverse (#1F2329 in light, #F0F6FC in dark) would show
  // through. Yellow here keeps the boot stack one continuous color and
  // reverts to theme.inverse the moment the splash unmounts, preserving
  // the bounce / landscape-notch behavior for normal use.
  const splashBgOverride =
    splashScreenState !== CONST.BOOT_SPLASH_STATE.HIDDEN
      ? {backgroundColor: theme.splashBG}
      : null;
  return (
    <SafeAreaView
      style={[styles.iPhoneXSafeArea, splashBgOverride]}
      edges={['left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

SafeArea.displayName = 'SafeArea';

export default SafeArea;
