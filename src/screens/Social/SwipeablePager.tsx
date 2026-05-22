import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import useWindowDimensions from '@hooks/useWindowDimensions';

type Route = {key: string};

type SwipeablePagerProps<R extends Route> = {
  routes: R[];
  index: number;
  onIndexChange: (i: number) => void;
  /** Called when the user swipes right past the first tab. Used to cascade into navigation back. */
  onSwipeBeyondStart?: () => void;
  renderScene: (props: {route: R}) => React.ReactNode;
};

const SPRING_CONFIG = {dampingRatio: 1, duration: 280};
const RUBBERBAND_RESISTANCE = 0.4;

const styles = StyleSheet.create({
  container: {flex: 1, overflow: 'hidden'},
  row: {flexDirection: 'row', flex: 1},
});

function SwipeablePager<R extends Route>({
  routes,
  index,
  onIndexChange,
  onSwipeBeyondStart,
  renderScene,
}: SwipeablePagerProps<R>) {
  const {windowWidth} = useWindowDimensions();
  const offset = useSharedValue(-index * windowWidth);
  const startX = useSharedValue(0);

  useEffect(() => {
    offset.value = withSpring(-index * windowWidth, SPRING_CONFIG);
    // eslint-disable-next-line rulesdir/prefer-narrow-hook-dependencies
  }, [index, windowWidth, offset]);

  const lastIndex = routes.length - 1;
  const maxOffset = 0;
  const minOffset = -lastIndex * windowWidth;

  /* eslint-disable react-hooks/immutability */
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-30, 30])
    .onStart(() => {
      startX.value = offset.value;
    })
    .onUpdate(e => {
      let next = startX.value + e.translationX;
      if (next > maxOffset) {
        next = maxOffset + (next - maxOffset) * RUBBERBAND_RESISTANCE;
      } else if (next < minOffset) {
        next = minOffset + (next - minOffset) * RUBBERBAND_RESISTANCE;
      }
      offset.value = next;
    })
    .onEnd(e => {
      const SWIPE_THRESHOLD = windowWidth / 3;
      const VELOCITY_THRESHOLD = 500;
      const dx = e.translationX;
      const vx = e.velocityX;

      const swipedRight = dx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD;
      const swipedLeft = dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD;

      if (swipedRight) {
        if (index === 0) {
          offset.value = withSpring(0, SPRING_CONFIG);
          if (onSwipeBeyondStart) {
            runOnJS(onSwipeBeyondStart)();
          }
          return;
        }
        runOnJS(onIndexChange)(index - 1);
        return;
      }
      if (swipedLeft && index < lastIndex) {
        runOnJS(onIndexChange)(index + 1);
        return;
      }
      offset.value = withSpring(-index * windowWidth, SPRING_CONFIG);
    });
  /* eslint-enable react-hooks/immutability */

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateX: offset.value}],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.row,
            {width: routes.length * windowWidth},
            animatedStyle,
          ]}>
          {routes.map(route => (
            <View key={route.key} style={{width: windowWidth, height: '100%'}}>
              {renderScene({route})}
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default SwipeablePager;
