import React, {useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import type Environment from '@libs/Environment/getEnvironment/types';
import AnimatedLogoShape from './AnimatedLogoShape';
import {TOTAL_DURATION_MS, WAVE_PERIOD_MS} from './animationTimings';
import LiquidFill from './LiquidFill';
import LogoBadge from './LogoBadge';
import {LOGO_CANVAS, LOGO_SHAPES} from './logoShapes';

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
 * solidifies the mark. Settles to the exact render output of the static
 * KirokuLogoSvg (full opacity, fill = theme.appLogo, no liquid).
 */
function AnimatedKirokuLogoSvg({
  fill,
  liquidColor,
  environment,
  shouldStart,
}: AnimatedKirokuLogoSvgProps) {
  const reduceMotion = useReducedMotion();
  // With reduced motion the timeline starts (and stays) settled.
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  // Repeating 0–1 phase for the wave surface; only oscillates while the
  // master timeline runs, then is cancelled so the settled logo costs nothing
  // per frame.
  const wavePhase = useSharedValue(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (shouldStart && !reduceMotion && !hasStarted.current) {
      hasStarted.current = true;
      // eslint-disable-next-line react-compiler/react-compiler
      progress.value = withTiming(
        1,
        {duration: TOTAL_DURATION_MS, easing: Easing.linear},
        () => {
          cancelAnimation(wavePhase);
        },
      );
      wavePhase.value = withRepeat(
        withTiming(1, {duration: WAVE_PERIOD_MS, easing: Easing.linear}),
        -1,
      );
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(wavePhase);
    };
  }, [shouldStart, reduceMotion, progress, wavePhase]);

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
