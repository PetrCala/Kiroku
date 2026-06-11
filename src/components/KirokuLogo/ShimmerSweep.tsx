import React, {useId} from 'react';
import {StyleSheet} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import Animated, {useAnimatedProps} from 'react-native-reanimated';
import Svg, {
  ClipPath,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import {SHIMMER_BAND_WIDTH, SHIMMER_PEAK_OPACITY} from './animationTimings';
import {LOGO_CANVAS, LOGO_SHAPES} from './logoShapes';
import getShimmerBandX, {
  SHIMMER_BAND_HEIGHT,
  SHIMMER_BAND_Y,
} from './shimmerBand';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type ShimmerSweepProps = {
  /** Highlight color (theme.success brand yellow) */
  color: string;

  /** Repeating 0–1 loop phase driving the sweep */
  shimmerPhase: SharedValue<number>;
};

/**
 * Ambient idle shimmer: a soft brand-yellow gradient band, clipped to the logo
 * silhouette, that sweeps diagonally across the resting mark each loop. The
 * gradient lives in the band's own bounding box (the default objectBoundingBox
 * units) so it travels with the Rect, and the diagonal 0,0→1,1 axis paints the
 * highlight as a tilted stripe (transparent edges, brand yellow at the center).
 *
 * Only the Rect's `x` animates — a direct native prop that is Fabric-safe,
 * unlike an SVG transform, which exposes no translate to Fabric (see
 * AnimatedLogoShape / LiquidFill). When the band parks off-screen during the
 * dwell, nothing renders, so the settled frame stays pixel-identical to the
 * static logo.
 */
function ShimmerSweep({color, shimmerPhase}: ShimmerSweepProps) {
  // Unique per mount so a second logo on screen (or web's document-global DOM
  // ids) can't collide; sanitized like LiquidFill's clip id.
  const idSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipPathId = `kirokuLogoShimmerClip-${idSuffix}`;
  const gradientId = `kirokuLogoShimmerGradient-${idSuffix}`;

  const animatedProps = useAnimatedProps(() => ({
    x: getShimmerBandX(shimmerPhase.value),
  }));

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
        <LinearGradient id={gradientId} x1={0} y1={0} x2={1} y2={1}>
          <Stop offset={0} stopColor={color} stopOpacity={0} />
          <Stop
            offset={0.5}
            stopColor={color}
            stopOpacity={SHIMMER_PEAK_OPACITY}
          />
          <Stop offset={1} stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <AnimatedRect
        animatedProps={animatedProps}
        y={SHIMMER_BAND_Y}
        width={SHIMMER_BAND_WIDTH}
        height={SHIMMER_BAND_HEIGHT}
        fill={`url(#${gradientId})`}
        clipPath={`url(#${clipPathId})`}
      />
    </Svg>
  );
}

ShimmerSweep.displayName = 'ShimmerSweep';

export default ShimmerSweep;
