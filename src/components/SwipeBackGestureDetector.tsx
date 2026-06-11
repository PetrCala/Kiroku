import React, {useMemo} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import useThemeStyles from '@hooks/useThemeStyles';

// A rightward swipe past this distance (px) — or faster than the velocity
// threshold — dismisses. Tuned alongside `activeOffsetX`/`failOffsetY` so the
// gesture coexists with a vertically-scrolling list underneath.
const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;

type SwipeBackGestureDetectorProps = {
  /** Invoked when the user completes a rightward swipe. When omitted the gesture
   *  stays inert, so the wrapped content behaves normally. */
  onSwipeBack?: () => void;

  /** Style for the gesture's host view. Defaults to filling the parent. */
  style?: StyleProp<ViewStyle>;

  children: React.ReactNode;
};

/**
 * Wraps content in a horizontal swipe-right-to-dismiss gesture.
 *
 * The Pan only activates on a clear horizontal drift and fails the moment a
 * vertical drift takes the lead, so a `FlashList`/`ScrollView` underneath keeps
 * every vertical pan. Shared by the fullscreen calendar and the day-overview
 * scroll so both transparent-modal screens dismiss the same way.
 */
function SwipeBackGestureDetector({
  onSwipeBack,
  style,
  children,
}: SwipeBackGestureDetectorProps) {
  const styles = useThemeStyles();
  const swipeBackGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!!onSwipeBack)
        // Only a rightward drag is a candidate; the generous left failOffset
        // keeps horizontal day-rows / the scrollbar from tripping it.
        .activeOffsetX(20)
        .failOffsetY([-20, 20])
        .onEnd(e => {
          'worklet';

          if (!onSwipeBack) {
            return;
          }
          if (
            e.translationX > SWIPE_DISTANCE_THRESHOLD ||
            e.velocityX > SWIPE_VELOCITY_THRESHOLD
          ) {
            runOnJS(onSwipeBack)();
          }
        }),
    [onSwipeBack],
  );

  return (
    <GestureDetector gesture={swipeBackGesture}>
      <View style={style ?? styles.flex1}>{children}</View>
    </GestureDetector>
  );
}

SwipeBackGestureDetector.displayName = 'SwipeBackGestureDetector';

export default SwipeBackGestureDetector;
