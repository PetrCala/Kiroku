import React, {useMemo} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';

// Past this horizontal travel (px) or fling velocity (px/s) on release, a
// rightward drag counts as a back gesture.
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

type SwipeBackGestureHandlerProps = {
  /** Mapped to a navigation back. The wrapper animates nothing itself — it
   *  only detects the rightward swipe and lets the stack's exit transition
   *  slide the screen out, so the dismissal looks identical across screens. */
  onSwipeBack?: () => void;

  /** When false the gesture is inert and touches pass straight to `children`
   *  — e.g. while the host pager is not on its left-most page, so inner
   *  horizontal swipes still page between tabs. */
  enabled?: boolean;

  style?: StyleProp<ViewStyle>;

  children: React.ReactNode;
};

const styles = StyleSheet.create({
  container: {flex: 1},
});

/**
 * Wrap a screen's content to make it dismissable with a rightward swipe,
 * matching the back gesture across the app's full-screen panes. The Pan only
 * activates on a clear horizontal drift and fails the moment a vertical drift
 * leads, so an inner vertical scroll (FlashList) wins every intra-content pan.
 */
function SwipeBackGestureHandler({
  onSwipeBack,
  enabled = true,
  style,
  children,
}: SwipeBackGestureHandlerProps) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && !!onSwipeBack)
        // Only positive translation (rightward swipe) is a candidate; a
        // generous vertical failOffset hands any near-vertical pan back to
        // inner scrollables.
        .activeOffsetX(20)
        .failOffsetY([-20, 20])
        .onEnd(e => {
          'worklet';

          if (!onSwipeBack) {
            return;
          }
          if (
            e.translationX > SWIPE_THRESHOLD ||
            e.velocityX > VELOCITY_THRESHOLD
          ) {
            runOnJS(onSwipeBack)();
          }
        }),
    [enabled, onSwipeBack],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, style]}>{children}</View>
    </GestureDetector>
  );
}

SwipeBackGestureHandler.displayName = 'SwipeBackGestureHandler';

export default SwipeBackGestureHandler;
