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
import useThemeStyles from '@hooks/useThemeStyles';
import BootSplash from '@libs/BootSplash';
import Log from '@libs/Log';
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

  const opacity = useSharedValue(1);

  const opacityStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: opacity.get(),
  }));

  const hideHasBeenCalled = useRef(false);

  const hide = useCallback(() => {
    // hide can only be called once
    if (hideHasBeenCalled.current) {
      return;
    }

    hideHasBeenCalled.current = true;

    // Native BootSplash owns the logo: RCTBootSplash crossfades the
    // in-process storyboard subview (PNG logo on yellow) to hidden over
    // 250ms. This JS overlay is a logo-less yellow card sitting underneath
    // the entire time; we only fade the card out *after* the native fade
    // resolves, so the overall sequence is "logo fades out → yellow card
    // fades out → home content". No second logo means no PNG↔SVG handoff
    // flicker, and the card still masks HomeScreen's first-paint loading
    // state until real content can paint.
    BootSplash.hide().then(() => {
      opacity.set(
        withTiming(
          0,
          {
            duration: 250,
            easing: Easing.out(Easing.ease),
          },
          () => runOnJS(onHide)(),
        ),
      );
    });
  }, [opacity, onHide]);

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
      style={[StyleSheet.absoluteFill, styles.splashScreenHider, opacityStyle]}
    />
  );
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
