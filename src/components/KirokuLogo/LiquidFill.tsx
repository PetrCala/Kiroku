import React, {useId} from 'react';
import {StyleSheet} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, {ClipPath, Defs, Path} from 'react-native-svg';
import {
  CROSSFADE_EASING,
  CROSSFADE_START_FRACTION,
  LIQUID_END_FRACTION,
  LIQUID_LEVEL_EASING,
  LIQUID_START_FRACTION,
  LIQUID_SURFACE_END_Y,
  LIQUID_SURFACE_START_Y,
} from './animationTimings';
import buildWavePathD from './liquidWave';
import {LOGO_CANVAS, LOGO_SHAPES} from './logoShapes';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type LiquidFillProps = {
  /** Liquid color (theme.success brand yellow) */
  color: string;

  /** Master timeline progress (0–1) owned by AnimatedKirokuLogoSvg */
  progress: SharedValue<number>;

  /** Repeating 0–1 phase driving the wave oscillation */
  wavePhase: SharedValue<number>;
};

/**
 * The rising liquid: a wave-topped body clipped to the logo silhouette.
 * Surface level and crossfade opacity derive from the master timeline; the
 * wave shape oscillates on its own repeating phase value. `d` and `opacity`
 * are the only animated props — both are direct native props of Path, which
 * is what makes this safe on Fabric (transforms would not be).
 */
function LiquidFill({color, progress, wavePhase}: LiquidFillProps) {
  // Unique per mount so a second logo instance on screen (e.g. AuthScreen's
  // static one, or web where DOM ids are document-global) can't collide.
  // Sanitized because React's id tokens contain ':', which is awkward
  // inside an `url(#...)` reference.
  const clipPathId = `kirokuLogoLiquidClip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const animatedProps = useAnimatedProps(() => {
    const level = interpolate(
      progress.value,
      [LIQUID_START_FRACTION, LIQUID_END_FRACTION],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const surfaceY =
      LIQUID_SURFACE_START_Y +
      (LIQUID_SURFACE_END_Y - LIQUID_SURFACE_START_Y) *
        LIQUID_LEVEL_EASING(level);
    const crossfade = interpolate(
      progress.value,
      [CROSSFADE_START_FRACTION, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      d: buildWavePathD(surfaceY, wavePhase.value),
      opacity: 1 - CROSSFADE_EASING(crossfade),
    };
  });

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Defs>
        <ClipPath id={clipPathId}>
          {LOGO_SHAPES.map(d => (
            <Path key={d} d={d} />
          ))}
        </ClipPath>
      </Defs>
      <AnimatedPath
        animatedProps={animatedProps}
        fill={color}
        clipPath={`url(#${clipPathId})`}
      />
    </Svg>
  );
}

LiquidFill.displayName = 'LiquidFill';

export default LiquidFill;
