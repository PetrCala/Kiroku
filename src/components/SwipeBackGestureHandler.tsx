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

  /** Optional leftward-swipe handler. Supply this only when the host owns a
   *  horizontal pager whose first page has disabled its own swipe so this
   *  gesture can win the rightward dismiss (a native pager-view swallows
   *  same-axis touches otherwise). Forwarding the leftward swipe back to the
   *  host keeps the "swipe to next tab" affordance on that boundary page.
   *  When set, the gesture activates on both directions. */
  onSwipeForward?: () => void;

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
  onSwipeForward,
  enabled = true,
  style,
  children,
}: SwipeBackGestureHandlerProps) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && (!!onSwipeBack || !!onSwipeForward))
        // Rightward swipes drive the back; a forward handler additionally
        // opts leftward swipes in. A generous vertical failOffset hands any
        // near-vertical pan back to inner scrollables.
        .activeOffsetX(onSwipeForward ? [-20, 20] : 20)
        .failOffsetY([-20, 20])
        .onEnd(e => {
          'worklet';

          const swipedRight =
            e.translationX > SWIPE_THRESHOLD ||
            e.velocityX > VELOCITY_THRESHOLD;
          const swipedLeft =
            e.translationX < -SWIPE_THRESHOLD ||
            e.velocityX < -VELOCITY_THRESHOLD;

          if (swipedRight && onSwipeBack) {
            runOnJS(onSwipeBack)();
            return;
          }
          if (swipedLeft && onSwipeForward) {
            runOnJS(onSwipeForward)();
          }
        }),
    [enabled, onSwipeBack, onSwipeForward],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, style]}>{children}</View>
    </GestureDetector>
  );
}

SwipeBackGestureHandler.displayName = 'SwipeBackGestureHandler';

export default SwipeBackGestureHandler;
