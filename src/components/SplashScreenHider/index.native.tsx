import {useCallback, useEffect, useRef} from 'react';
import type {ViewStyle} from 'react-native';
import {StyleSheet} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
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

// Storyboard asset is 108pt (108/216/324 at 1×/2×/3×). The JS overlay must
// render the logo at the SAME size as the storyboard so the handoff from the
// in-process native splash to this JS overlay is visually seamless. Before
// PR #325 this was read from the native module's constantsToExport, but iOS
// never exported it, so it fell back to 100pt and produced a visible ~7.4%
// size jump. Hardcoding 108pt eliminates that mismatch.
const LOGO_SIZE = 108;

function SplashScreenHider({
  onHide = () => {},
  shouldHideSplash,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const styles = useThemeStyles();

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
      // DIAGNOSTIC — DO NOT MERGE.
      // Skip the scale/opacity animations and hold the JS overlay visible
      // for 3 seconds so we can directly observe what it looks like the
      // moment the native loadingView is removed. Combined with the red
      // backgroundColor on the outer view below, this distinguishes four
      // outcomes:
      //   • red bg + white logo for 3s → JS overlay fully painted; the
      //     animation startup was the gap
      //   • red bg, no logo for 3s → ImageSVG layer isn't painting
      //   • yellow, no logo for 3s → JS overlay invisible entirely;
      //     what we see is the guard/SafeArea/proxy beneath
      //   • red bg + white logo immediately then logo briefly disappears
      //     mid-way → animation start is glitching transform
      setTimeout(onHide, 3000);
    });
  }, [onHide]);

  useEffect(() => {
    if (!shouldHideSplash) {
      return;
    }
    // DIAGNOSTIC — DO NOT MERGE.
    //
    // Single rAF deferral didn't close the logo gap, so we don't actually
    // know whether the problem is paint timing (the JS overlay needs more
    // time than rAF buys) or something structural (the JS overlay's logo
    // never reaches the framebuffer at all in this configuration).
    //
    // 2000ms holds the native BootSplash up long enough that paint timing
    // can't be the bottleneck. Cold-launch with this build and observe the
    // moment the native splash finally dismisses:
    //
    //   • Logo present with zero gap when native hides
    //     → paint timing IS the cause; single rAF was insufficient. Solve
    //       by waiting for the actual paint event (onLayout, double-rAF,
    //       a longer timeout sized to worst-real-device behavior).
    //
    //   • Logo still hides then reappears even after 2 seconds of warm-up
    //     → paint timing is NOT the cause. Something about how the JS
    //       overlay's logo enters the framebuffer breaks under this
    //       configuration (re-render on prop change tearing down the
    //       react-native-svg layer, react-compiler unmounting on
    //       shouldHideSplash flip, asset loading lifecycle, etc.) and we
    //       investigate elsewhere.
    const handle = setTimeout(() => hide(), 2000);
    return () => clearTimeout(handle);
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
        // DIAGNOSTIC — DO NOT MERGE.
        // Override the yellow splashBG with red so we can tell whether the
        // JS overlay is actually composited on screen at the moment the
        // native loadingView is removed. Without this, "yellow without
        // logo" is ambiguous — could be the JS overlay painted-but-no-svg,
        // OR the JS overlay invisible-and-we-see-yellow-beneath.
        {backgroundColor: 'red'},
        opacityStyle,
      ]}>
      <Reanimated.View style={scaleStyle}>
        <ImageSVG
          contentFit="fill"
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
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
