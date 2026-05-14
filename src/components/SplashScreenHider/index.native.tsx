import {useCallback, useEffect, useRef} from 'react';
import type {ViewStyle} from 'react-native';
import {StyleSheet} from 'react-native';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import ImageSVG from '@components/ImageSVG';
import useThemeStyles from '@hooks/useThemeStyles';
import BootSplash from '@libs/BootSplash';
import Log from '@libs/Log';
import colors from '@src/styles/theme/colors';
import type {
  SplashScreenHiderProps,
  SplashScreenHiderReturnType,
} from './types';

// Force-hide the splash if shouldHideSplash hasn't fired by this point.
// Protects against deadlocks where a gating condition (e.g. hasCheckedAutoLogin)
// never flips and the user is left staring at the yellow overlay indefinitely.
const FORCE_HIDE_TIMEOUT_MS = 15 * 1000;

function SplashScreenHider({
  onHide = () => {},
  shouldHideSplash,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const styles = useThemeStyles();
  const logoSizeRatio = BootSplash.logoSizeRatio || 1;
  const logoWidth = BootSplash.logoWidth || 100;
  const logoHeight = BootSplash.logoHeight || 100;
  const navigationBarHeight = BootSplash.navigationBarHeight || 0;

  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const opacityStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: opacity.get(),
  }));
  const scaleStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{scale: scale.get()}],
  }));

  const hideHasBeenCalled = useRef(false);

  const hide = useCallback(() => {
    // hide can only be called once
    if (hideHasBeenCalled.current) {
      return;
    }

    hideHasBeenCalled.current = true;

    BootSplash.hide().then(() => {
      scale.set(
        withTiming(0, {
          duration: 200,
          easing: Easing.back(2),
        }),
      );

      opacity.set(
        withTiming(
          0,
          {
            duration: 250,
            easing: Easing.out(Easing.ease),
          },
          runOnJS(onHide),
        ),
      );
    });
  }, [opacity, scale, onHide]);

  useEffect(() => {
    if (!shouldHideSplash) {
      return;
    }
    hide();
  }, [shouldHideSplash, hide]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (hideHasBeenCalled.current) {
        return;
      }
      Log.alert(
        '[BootSplash] shouldHideSplash never became true, force-hiding splash',
        {timeoutMs: FORCE_HIDE_TIMEOUT_MS},
        false,
      );
      hide();
    }, FORCE_HIDE_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [hide]);

  return (
    <Reanimated.View
      style={[
        StyleSheet.absoluteFill,
        styles.splashScreenHider,
        opacityStyle,
        {
          // Apply negative margins to center the logo on window (instead of screen)
          marginBottom: -navigationBarHeight,
        },
      ]}>
      <Reanimated.View style={scaleStyle}>
        <ImageSVG
          contentFit="fill"
          style={{
            width: logoWidth * logoSizeRatio,
            height: logoHeight * logoSizeRatio,
          }}
          fill={colors.white}
          src={KirokuIcons.Logo}
        />
      </Reanimated.View>
    </Reanimated.View>
  );
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
