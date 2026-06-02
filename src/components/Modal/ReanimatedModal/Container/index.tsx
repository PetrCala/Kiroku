import React, {useEffect, useMemo} from 'react';
import {View} from 'react-native';
import Animated, {
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import type ReanimatedModalProps from '@components/Modal/ReanimatedModal/types';
import type {ContainerProps} from '@components/Modal/ReanimatedModal/types';
import {
  easing,
  getModalOutAnimation,
} from '@components/Modal/ReanimatedModal/utils';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import GestureHandler from './GestureHandler';

function Container({
  style,
  animationInTiming = CONST.MODAL.ANIMATION_TIMING.DEFAULT_IN,
  animationOutTiming = CONST.MODAL.ANIMATION_TIMING.DEFAULT_OUT,
  onCloseCallBack,
  onOpenCallBack,
  animationIn,
  animationOut,
  type,
  onSwipeComplete,
  swipeDirection,
  swipeThreshold = 100,
  ...props
}: Partial<ReanimatedModalProps> & ContainerProps) {
  const styles = useThemeStyles();
  const initProgress = useSharedValue(0);
  const isInitiated = useSharedValue(false);

  // Drive the open animation through a shared value + useAnimatedStyle instead
  // of an `entering` Keyframe. On the New Architecture a Keyframe's `from` frame
  // is not applied before the first paint, so the modal flashes at its final
  // state for one frame; applying progress=0 via useAnimatedStyle on mount
  // avoids that. Mirrors the web Container (index.web.tsx).
  useEffect(() => {
    if (isInitiated.get()) {
      return;
    }
    isInitiated.set(true);
    initProgress.set(
      withTiming(
        1,
        {
          duration: animationInTiming,
          easing,
          // Without this the completion callback is skipped when the OS
          // reduce-motion setting is on, leaving the modal stuck transitioning.
          reduceMotion: ReduceMotion.Never,
        },
        () => {
          'worklet';

          scheduleOnRN(onOpenCallBack);
        },
      ),
    );
  }, [animationInTiming, onOpenCallBack, initProgress, isInitiated]);

  // Equivalent to getModalInAnimationStyle (used by the web Container) but
  // inlined: that helper isn't a worklet, so it can't be called from this
  // UI-thread worklet on native.
  const animatedStyles = useAnimatedStyle(() => {
    const progress = initProgress.get();
    if (animationIn === 'slideInUp') {
      return {transform: [{translateY: `${100 * (1 - progress)}%`}]};
    }
    if (animationIn === 'slideInRight') {
      return {transform: [{translateX: `${100 * (1 - progress)}%`}]};
    }
    // 'fadeIn' (and any default)
    return {opacity: progress};
  }, [initProgress, animationIn]);

  const Exiting = useMemo(() => {
    const AnimationOut = new Keyframe(getModalOutAnimation(animationOut));

    return AnimationOut.duration(animationOutTiming)
      .withCallback(() => {
        'worklet';

        scheduleOnRN(onCloseCallBack);
      })
      .reduceMotion(ReduceMotion.Never);
  }, [animationOutTiming, onCloseCallBack, animationOut]);

  return (
    <View
      // `flex1` fills the RN Modal's content area so each modal type's own
      // `justifyContent`/`alignItems` (from `style`) can position the sheet —
      // e.g. BOTTOM_DOCKED's `flex-end` docks it to the bottom. react-native-modal
      // provided this implicit fill before the migration. `style` is spread after
      // so a type that sets its own size still wins.
      style={[styles.flex1, style]}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}>
      <GestureHandler
        swipeThreshold={swipeThreshold}
        swipeDirection={swipeDirection}
        onSwipeComplete={onSwipeComplete}>
        <Animated.View
          style={[
            styles.modalAnimatedContainer,
            // BOTTOM_DOCKED, CENTERED_SMALL and CONFIRM stay content-sized so the
            // outer `style` (flex-end / center) can position the sheet; the
            // others fill.
            type !== CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED &&
              type !== CONST.MODAL.MODAL_TYPE.CENTERED_SMALL &&
              type !== CONST.MODAL.MODAL_TYPE.CONFIRM &&
              styles.flex1,
            animatedStyles,
          ]}
          exiting={Exiting}>
          {props.children}
        </Animated.View>
      </GestureHandler>
    </View>
  );
}

export default Container;
