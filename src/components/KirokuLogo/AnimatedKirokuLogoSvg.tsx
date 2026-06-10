import {useIsFocused} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import type Environment from '@libs/Environment/getEnvironment/types';
import AnimatedLogoShape from './AnimatedLogoShape';
import {
  SHIMMER_PERIOD_MS,
  TOTAL_DURATION_MS,
  WAVE_PERIOD_MS,
} from './animationTimings';
import LiquidFill from './LiquidFill';
import LogoBadge from './LogoBadge';
import {LOGO_CANVAS, LOGO_SHAPES} from './logoShapes';
import ShimmerSweep from './ShimmerSweep';

type AnimatedKirokuLogoSvgProps = {
  /** Fill color of the mark (theme.appLogo) */
  fill: string;

  /** Color of the rising liquid (theme.success) */
  liquidColor: string;

  /** Current app environment for the badge overlay (static, non-prod only) */
  environment: Environment;

  /**
   * Starts the sequence when it flips true. While false the layers stay armed
   * at progress 0 (invisible), so on cold boot the entrance doesn't play
   * unseen behind the boot splash. Latched once per mount: flipping back to
   * false never restarts.
   */
  shouldStart: boolean;

  /**
   * True only while the boot splash is handing its logo off into this slot. The
   * mark renders already-settled (progress 1) instead of playing the assembly
   * entrance — the splash flight stands in for it. Latched per mount: once a
   * handoff settles this mount it never plays the entrance, even after the flag
   * clears. Defaults to false, so every non-handoff appearance plays normally.
   */
  isHandoff?: boolean;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
});

/**
 * Animated variant of the logo: the six shapes stagger in as a faint ghost,
 * a liquid with a waving surface fills the silhouette, and a final crossfade
 * solidifies the mark. Once settled, a subtle brand-yellow shimmer sweeps
 * across the resting mark on a long loop. Settles to the exact render output of
 * the static KirokuLogoSvg (full opacity, fill = theme.appLogo, no liquid) and,
 * between shimmer sweeps, is pixel-identical to it.
 */
function AnimatedKirokuLogoSvg({
  fill,
  liquidColor,
  environment,
  shouldStart,
  isHandoff = false,
}: AnimatedKirokuLogoSvgProps) {
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();
  // With reduced motion the timeline starts (and stays) settled.
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  // Repeating 0–1 phase for the wave surface; only oscillates while the
  // master timeline runs, then is cancelled so the settled logo costs nothing
  // per frame.
  const wavePhase = useSharedValue(0);
  // Repeating 0–1 phase for the ambient shimmer; only runs once the entrance
  // has settled and the screen is focused (see the effect below).
  const shimmerPhase = useSharedValue(0);
  const hasStarted = useRef(false);
  // Flipped true when the master timeline finishes, gating the shimmer so it
  // never plays over the entrance. Set from the timing's completion callback.
  const [hasSettled, setHasSettled] = useState(false);

  // One latched timeline so `progress` keeps a single mutation site (two would
  // regress react-compiler). It settles one of two ways, then never re-arms:
  //   • Handoff (isHandoff): jump straight to the settled mark — zero duration,
  //     no wave — underneath the flying splash logo, so the entrance never
  //     plays. When the splash later releases `shouldStart` the latch is
  //     already set and this stays put.
  //   • Entrance (shouldStart, no reduced motion): run the full assembly.
  useEffect(() => {
    const shouldHandoff = isHandoff;
    const shouldPlayEntrance = shouldStart && !reduceMotion;
    if (!hasStarted.current && (shouldHandoff || shouldPlayEntrance)) {
      hasStarted.current = true;
      // eslint-disable-next-line react-compiler/react-compiler
      progress.value = withTiming(
        1,
        {
          duration: shouldHandoff ? 0 : TOTAL_DURATION_MS,
          easing: Easing.linear,
        },
        () => {
          cancelAnimation(wavePhase);
          runOnJS(setHasSettled)(true);
        },
      );
      if (!shouldHandoff) {
        // eslint-disable-next-line react-compiler/react-compiler
        wavePhase.value = withRepeat(
          withTiming(1, {duration: WAVE_PERIOD_MS, easing: Easing.linear}),
          -1,
        );
      }
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(wavePhase);
    };
  }, [shouldStart, reduceMotion, isHandoff, progress, wavePhase]);

  // Ambient shimmer loop. Runs only after the entrance settles and only while
  // the screen is focused: navigating InitialScreen → AuthScreen pushes over
  // this screen without unmounting it, so an always-on loop would keep burning
  // frames behind AuthScreen. Cancelled on blur and on unmount, mirroring the
  // wavePhase lifecycle. Restarts from a clean sweep when focus returns.
  useEffect(() => {
    if (reduceMotion || !hasSettled || !isFocused) {
      return undefined;
    }
    // eslint-disable-next-line react-compiler/react-compiler
    shimmerPhase.value = 0;
    // eslint-disable-next-line react-compiler/react-compiler
    shimmerPhase.value = withRepeat(
      withTiming(1, {duration: SHIMMER_PERIOD_MS, easing: Easing.linear}),
      -1,
    );
    return () => {
      cancelAnimation(shimmerPhase);
    };
  }, [reduceMotion, hasSettled, isFocused, shimmerPhase]);

  return (
    <View style={styles.container}>
      {LOGO_SHAPES.map((d, index) => (
        <AnimatedLogoShape
          key={d}
          d={d}
          index={index}
          fill={fill}
          progress={progress}
        />
      ))}
      <LiquidFill
        color={liquidColor}
        progress={progress}
        wavePhase={wavePhase}
      />
      {!reduceMotion && (
        <ShimmerSweep color={liquidColor} shimmerPhase={shimmerPhase} />
      )}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none">
        <LogoBadge environment={environment} />
      </Svg>
    </View>
  );
}

AnimatedKirokuLogoSvg.displayName = 'AnimatedKirokuLogoSvg';

export default AnimatedKirokuLogoSvg;
