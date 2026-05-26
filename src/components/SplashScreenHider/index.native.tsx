import {useCallback, useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, Image, Platform, StyleSheet} from 'react-native';
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

// Storyboard asset is 108pt (108/216/324 at 1×/2×/3×). The JS overlay
// renders the logo at the same size so the native → JS handoff is seamless.
const LOGO_SIZE = 108;

function SplashScreenHider({
  onHide = () => {},
  shouldHideSplash,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const styles = useThemeStyles();

  // Use React Native's Animated API (not Reanimated). Reanimated 4 on Fabric
  // binds animated styles via a worklet that may not execute on the first
  // commit, leaving the outer View briefly rendered with opacity 0 — the
  // source of the visible "flash" at the handoff in the old design. RN's
  // Animated applies initial values synchronously on first render, so the
  // first paint is at opacity 1 / scale 1 deterministically.
  // useMemo with an empty dep array creates the Animated.Value once per
  // mount. Avoids `useRef(new Animated.Value(1)).current` which trips
  // the react-hooks/refs lint rule (ref access during render).
  const opacity = useMemo(() => new Animated.Value(1), []);
  const scale = useMemo(() => new Animated.Value(1), []);

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
    //
    // After the native dissolve resolves, run a JS-side fade so the
    // logo gracefully shrinks + fades to reveal the home screen
    // beneath, instead of cutting instantly.
    BootSplash.hide().then(() => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          onHide();
        }
      });
    });
  }, [onHide, opacity, scale]);

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
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.splashScreenHider, {opacity}]}>
      <Animated.View style={{transform: [{scale}]}}>
        {Platform.OS === 'ios' ? (
          // iOS: load BootSplashLogo from the asset catalog via
          // [UIImage imageNamed:]. The string-uri form falls through to
          // exactly the same UIImage instance the BootSplash storyboard's
          // own UIImageView renders — same anti-aliasing, same edge alpha,
          // same color profile. Critical: any other source (Metro PNG, SVG
          // via react-native-svg, etc.) produces pixel-level differences
          // from the storyboard render that show as a logo "blink" at the
          // cross-dissolve boundary, even though positions and sizes match.
          <Image
            source={{uri: 'BootSplashLogo'}}
            style={{width: LOGO_SIZE, height: LOGO_SIZE}}
            resizeMode="contain"
          />
        ) : (
          <ImageSVG
            contentFit="fill"
            style={{width: LOGO_SIZE, height: LOGO_SIZE}}
            fill={colors.white}
            src={KirokuIcons.Logo}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
