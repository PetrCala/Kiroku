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

  // Plain View (not Reanimated.View). Reanimated 4 on Fabric binds
  // animated styles via a worklet that may not execute on the first
  // commit, leaving the View briefly rendered with opacity 0 — the
  // source of the visible "flash" at the handoff before this refactor.
  // Background and logo are static; the native cross-dissolve in
  // BootSplash.hide() provides the only fade.
  // DIAGNOSTIC v9 — DO NOT MERGE.
  // Use the iOS asset catalog image directly via `source={{uri: ...}}`.
  // The string URI form falls through to [UIImage imageNamed:] internally,
  // which loads BootSplashLogo from the same asset catalog the storyboard's
  // UIImageView uses. Both layers should now render identical pixels —
  // including identical anti-aliasing on the logo's edges. If the blink
  // disappears with this change, edge anti-aliasing mismatch between SVG
  // path rendering and UIImage rendering was the cause.
  return (
    <View style={[StyleSheet.absoluteFill, styles.splashScreenHider]}>
      <Image
        source={{uri: 'BootSplashLogo'}}
        style={{width: LOGO_SIZE, height: LOGO_SIZE}}
        resizeMode="contain"
      />
    </View>
  );
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
