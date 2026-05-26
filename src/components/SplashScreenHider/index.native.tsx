import {useCallback, useEffect, useRef} from 'react';
import {Image, StyleSheet, View} from 'react-native';
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

// Storyboard asset is 108pt (108/216/324 at 1×/2×/3×). The JS overlay must
// render the logo at the SAME size as the storyboard so the handoff from the
// in-process native splash to this JS overlay is visually seamless. Before
// PR #325 this was read from the native module's constantsToExport, but iOS
// never exported it, so it fell back to 100pt and produced a visible ~7.4%
// size jump. Hardcoding 108pt eliminates that mismatch.
const LOGO_SIZE = 108;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const LOGO_PNG = require('@assets/images/app-logo.png');

function SplashScreenHider({
  onHide = () => {},
  shouldHideSplash,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const styles = useThemeStyles();

  const hideHasBeenCalled = useRef(false);

  const hide = useCallback(() => {
    if (hideHasBeenCalled.current) {
      return;
    }

    hideHasBeenCalled.current = true;

    // BootSplash.hide() runs a 250ms cross-dissolve on the native side
    // (fade=1 in RCTBootSplash.mm). The dissolve forces iOS to render
    // the React tree underneath the storyboard view to prepare its
    // AFTER state — which masks Fabric's incremental mounting cascade
    // (proxy → GestureHandlerRootView → SplashScreenHider). By the
    // time the dissolve resolves, the React tree is fully composited.
    // No JS-side fade animation is needed; this component just owns
    // the safety timeout and unmounts when the native dissolve
    // resolves.
    BootSplash.hide().then(() => {
      onHide();
    });
  }, [onHide]);

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

  // DIAGNOSTIC — DO NOT MERGE.
  // Swap ImageSVG (react-native-svg) for a plain RN <Image> using the
  // existing app-logo.png. react-native-svg constructs a CAShapeLayer
  // with path data which has its own first-draw cost; UIImage is a
  // precomputed bitmap that paints in the same frame as its parent.
  // If the residual logo flicker disappears with this change, the SVG
  // first-paint lag was the cause and the production fix is to use the
  // PNG here.
  return (
    <View style={[StyleSheet.absoluteFill, styles.splashScreenHider]}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        source={LOGO_PNG}
        style={{width: LOGO_SIZE, height: LOGO_SIZE}}
        resizeMode="contain"
      />
    </View>
  );
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
