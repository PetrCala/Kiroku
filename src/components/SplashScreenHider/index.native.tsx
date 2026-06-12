import {useCallback, useContext, useEffect, useMemo, useRef} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import ImageSVG from '@components/ImageSVG';
import SplashScreenStateContext from '@context/global/SplashScreenStateContext';
import useThemeStyles from '@hooks/useThemeStyles';
import BootSplash from '@libs/BootSplash';
import * as FeatureFlags from '@libs/FeatureFlags';
import Log from '@libs/Log';
import CONST from '@src/CONST';
import type {
  SplashScreenHiderProps,
  SplashScreenHiderReturnType,
} from './types';

// Force-hide the splash if shouldHideSplash hasn't fired by this point.
// Protects against deadlocks where a gating condition (e.g. hasCheckedAutoLogin)
// never flips and the user is left staring at the yellow overlay indefinitely.
const FORCE_HIDE_TIMEOUT_MS = CONST.BOOT_SPLASH_FORCE_HIDE_TIMEOUT_MS;

// Storyboard asset is 108pt (108/216/324 at 1×/2×/3×). The JS overlay
// renders the logo at the same size so the native → JS handoff is seamless.
const LOGO_SIZE = 108;

// Shrink-out (every path except the signed-out cold-boot handoff): the centered
// logo shrinks while the overlay fades, revealing whatever is underneath.
const SHRINK_SCALE_MS = 200;
const SHRINK_FADE_MS = 250;

// Handoff (signed-out cold boot): the splash logo flies from screen center into
// the InitialScreen logo slot, then the whole overlay fades — crossfading the
// splash logo onto the settled in-app logo already rendered at the same spot,
// so launch → initial screen reads as one continuous scene.
const HANDOFF_FLIGHT_MS = 450;
const HANDOFF_REVEAL_MS = 220;
// Decelerating curve so the logo eases into the slot rather than stopping dead.
const HANDOFF_FLIGHT_EASING = Easing.bezier(0.22, 1, 0.36, 1);

function SplashScreenHider({
  onHide = () => {},
  shouldHideSplash,
}: SplashScreenHiderProps): SplashScreenHiderReturnType {
  const styles = useThemeStyles();
  const {logoHandoffTargetRef, setIsLogoHandoffActive} = useContext(
    SplashScreenStateContext,
  );

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
  // Translation from screen center toward the logo slot, used only on the
  // handoff path; stays 0 for the shrink-out so its transform matches the old
  // scale-only behavior exactly.
  const translateX = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(0), []);

  const hideHasBeenCalled = useRef(false);

  const hide = useCallback(() => {
    if (hideHasBeenCalled.current) {
      return;
    }

    hideHasBeenCalled.current = true;

    // The unchanged shrink-out: logo scales to nothing while the overlay fades.
    // Every non-handoff path lands here, and it never depends on the logo slot,
    // so it can't be stranded waiting for a target that never arrives.
    const shrinkOut = () => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0,
          duration: SHRINK_SCALE_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: SHRINK_FADE_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          onHide();
        }
      });
    };

    // BootSplash.hide() runs a 250ms cross-dissolve on the native side
    // (fade=1 in RCTBootSplash.mm). The dissolve forces iOS to render
    // the React tree underneath the storyboard view to prepare its
    // AFTER state — which masks Fabric's incremental mounting cascade
    // (proxy → GestureHandlerRootView → SplashScreenHider). By the
    // time the dissolve resolves, the React tree is fully composited.
    //
    // After the native dissolve resolves, either fly the logo into the
    // InitialScreen slot (signed-out cold boot) or fall back to the
    // shrink-out (authenticated boot, reduced motion, or no slot reported).
    BootSplash.hide().then(async () => {
      const target = logoHandoffTargetRef.current;
      const reduceMotionEnabled =
        await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);

      // Handoff only when the fly-in feature is enabled, the signed-out tree
      // reported a usable logo slot, and motion isn't reduced. Otherwise keep
      // today's hide. With LOGO_FLY_IN off, every path shrinks out and the
      // in-app logo plays its full assembly + liquid-fill entrance.
      if (
        !FeatureFlags.isEnabled('LOGO_FLY_IN') ||
        !target ||
        target.width <= 0 ||
        target.height <= 0 ||
        reduceMotionEnabled
      ) {
        shrinkOut();
        return;
      }

      // The overlay is full-window and centers the logo, so its center is the
      // window center. (iOS SafeArea only insets left/right, and cold boot is
      // portrait, so there's no vertical offset to account for.)
      const {width: windowWidth, height: windowHeight} =
        Dimensions.get('window');
      const slotCenterX = target.x + target.width / 2;
      const slotCenterY = target.y + target.height / 2;
      const dx = slotCenterX - windowWidth / 2;
      const dy = slotCenterY - windowHeight / 2;
      // KirokuLogoSvg preserves aspect ratio (meet), so the visible mark is
      // bounded by the slot's smaller side. The splash logo and the in-app logo
      // derive from the same master art, so scaling the 108pt splash frame to
      // that size lands the two marks on top of each other.
      const targetScale = Math.min(target.width, target.height) / LOGO_SIZE;

      // Tell the in-app logo to render settled underneath; the opaque overlay
      // still masks it until the reveal fade below.
      setIsLogoHandoffActive(true);

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: dx,
          duration: HANDOFF_FLIGHT_MS,
          easing: HANDOFF_FLIGHT_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: dy,
          duration: HANDOFF_FLIGHT_MS,
          easing: HANDOFF_FLIGHT_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: targetScale,
          duration: HANDOFF_FLIGHT_MS,
          easing: HANDOFF_FLIGHT_EASING,
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (!finished) {
          return;
        }
        // Reveal: fade the whole overlay (yellow bg + splash logo) out. Because
        // the settled in-app logo sits at the same spot and size, the splash
        // logo crossfades onto it with no positional pop and no hard cut to
        // expose the storyboard-PNG vs SVG rasterization difference.
        Animated.timing(opacity, {
          toValue: 0,
          duration: HANDOFF_REVEAL_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(({finished: revealFinished}) => {
          if (revealFinished) {
            onHide();
          }
        });
      });
    });
  }, [
    onHide,
    opacity,
    scale,
    translateX,
    translateY,
    logoHandoffTargetRef,
    setIsLogoHandoffActive,
  ]);

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
      <Animated.View style={{transform: [{translateX}, {translateY}, {scale}]}}>
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
          // The mascot master is full-color art — render it untinted so the
          // overlay matches the native bootsplash_logo.png pixel for pixel.
          <ImageSVG
            contentFit="fill"
            style={{width: LOGO_SIZE, height: LOGO_SIZE}}
            src={KirokuIcons.Logo}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

SplashScreenHider.displayName = 'SplashScreenHider';

export default SplashScreenHider;
