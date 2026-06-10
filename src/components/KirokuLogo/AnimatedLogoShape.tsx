import React from 'react';
import {StyleSheet} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';
import {
  CROSSFADE_EASING,
  CROSSFADE_START_FRACTION,
  getShapeWindow,
  GHOST_OPACITY,
  SHAPE_OPACITY_EASING,
  SHAPE_TRANSLATE_DISTANCE,
  SHAPE_TRANSLATE_EASING,
} from './animationTimings';
import {LOGO_CANVAS} from './logoShapes';

type AnimatedLogoShapeProps = {
  /** Path data of this shape (one entry of LOGO_SHAPES) */
  d: string;

  /** Position in the stagger order (index into LOGO_SHAPES) */
  index: number;

  /** Fill color of the mark */
  fill: string;

  /** Master timeline progress (0–1) owned by AnimatedKirokuLogoSvg */
  progress: SharedValue<number>;
};

/**
 * One layer of the assembled logo: a full-viewBox Svg holding a single shape,
 * wrapped in an Animated.View so opacity/transform animate through regular
 * view styles. Transforms can't go through SVG animatedProps — react-native-svg
 * exposes no translate props to Fabric (only a composed `matrix`), so
 * animatedProps transforms would silently no-op on native.
 */
function AnimatedLogoShape({d, index, fill, progress}: AnimatedLogoShapeProps) {
  const [windowStart, windowEnd] = getShapeWindow(index);

  const animatedStyle = useAnimatedStyle(() => {
    const entrance = interpolate(
      progress.value,
      [windowStart, windowEnd],
      [0, 1],
      Extrapolation.CLAMP,
    );
    // Entrance fades the shape in to its faint ghost state; the crossfade at
    // the end of the timeline solidifies it to full opacity as the liquid
    // drains away.
    const crossfade = interpolate(
      progress.value,
      [CROSSFADE_START_FRACTION, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity:
        SHAPE_OPACITY_EASING(entrance) * GHOST_OPACITY +
        (1 - GHOST_OPACITY) * CROSSFADE_EASING(crossfade),
      transform: [
        {
          translateY:
            (1 - SHAPE_TRANSLATE_EASING(entrance)) * SHAPE_TRANSLATE_DISTANCE,
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, animatedStyle]}
      pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}>
        <Path d={d} fill={fill} />
      </Svg>
    </Animated.View>
  );
}

AnimatedLogoShape.displayName = 'AnimatedLogoShape';

export default AnimatedLogoShape;
