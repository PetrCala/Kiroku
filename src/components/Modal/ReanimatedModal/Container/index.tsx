import React, {useCallback, useEffect, useMemo} from 'react';
import type {LayoutChangeEvent} from 'react-native';
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
import useWindowDimensions from '@hooks/useWindowDimensions';
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
  const {windowHeight, windowWidth} = useWindowDimensions();
  const initProgress = useSharedValue(0);
  const isInitiated = useSharedValue(false);

  // BOTTOM_DOCKED, CENTERED_SMALL and CONFIRM stay content-sized so the outer
  // `style` (flex-end / center) can position the sheet; the others fill.
  const fillContainer =
    type !== CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED &&
    type !== CONST.MODAL.MODAL_TYPE.CENTERED_SMALL &&
    type !== CONST.MODAL.MODAL_TYPE.CONFIRM;

  const isSlide = animationIn === 'slideInUp' || animationIn === 'slideInRight';

  // A content-sized sliding sheet (BOTTOM_DOCKED) can't resolve a percentage
  // translate (`translateY: 100%`) before its first paint on the New
  // Architecture: its auto size isn't measured yet, so the percentage resolves
  // to 0 and the sheet flashes at its docked (final) position for one frame
  // (#813). Fill sheets size to their parent, so the percentage resolves
  // immediately (the #783 fix). For the content-sized case we translate by a
  // concrete pixel distance instead (see `slideDistance`).
  const needsMeasuredSlide = isSlide && !fillContainer;

  // Pixel distance the content-sized sheet travels on open. It starts at the
  // full window size: a concrete number resolves on the first frame (no
  // percentage-vs-layout flash) and is always larger than the sheet, so the
  // sheet starts fully off-screen and is guaranteed to slide in — it can never
  // get stuck hidden (the failure of an opacity/`onLayout` gate). The first
  // onLayout then refines it to the sheet's own measured size for a tight slide;
  // that fires while the sheet is still off-screen, so the refinement isn't
  // visible.
  const slideDistance = useSharedValue(
    animationIn === 'slideInRight' ? windowWidth : windowHeight,
  );
  const hasMeasuredSlide = useSharedValue(false);

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

  // Refine the travel to the sheet's own height once (so the slide is tight, not
  // a full-window sweep). Only the open is affected; later re-layouts are
  // ignored so dynamic content can't retrigger the offset mid-animation.
  const onContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!needsMeasuredSlide || hasMeasuredSlide.get()) {
        return;
      }
      const {height, width} = event.nativeEvent.layout;
      const distance = animationIn === 'slideInUp' ? height : width;
      if (distance <= 0) {
        return;
      }
      hasMeasuredSlide.set(true);
      slideDistance.set(distance);
    },
    [needsMeasuredSlide, animationIn, slideDistance, hasMeasuredSlide],
  );

  // Equivalent to getModalInAnimationStyle (used by the web Container) but
  // inlined: that helper isn't a worklet, so it can't be called from this
  // UI-thread worklet on native.
  const animatedStyles = useAnimatedStyle(() => {
    const progress = initProgress.get();
    if (animationIn === 'slideInUp' || animationIn === 'slideInRight') {
      if (needsMeasuredSlide) {
        // Concrete-pixel translate (window size, refined to the measured sheet
        // size) so the off-screen start resolves on the first frame.
        const offset = slideDistance.get() * (1 - progress);
        return animationIn === 'slideInUp'
          ? {transform: [{translateY: offset}]}
          : {transform: [{translateX: offset}]};
      }
      return animationIn === 'slideInUp'
        ? {transform: [{translateY: `${100 * (1 - progress)}%`}]}
        : {transform: [{translateX: `${100 * (1 - progress)}%`}]};
    }
    // 'fadeIn' (and any default)
    return {opacity: progress};
  }, [initProgress, animationIn, needsMeasuredSlide, slideDistance]);

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
        {/*
          The outer wrapper carries ONLY the `exiting` layout animation; the open
          transform/opacity (`animatedStyles`) lives on the inner view. Keeping the
          layout animation and the animated style on separate elements avoids
          Reanimated's "Property ... may be overwritten by a layout animation"
          dev warning (the exiting Keyframe animates the same transform/opacity).
          The wrapper keeps the sizing so the exiting transform's percentage and
          the inner view's flex fill both resolve against the full container.
        */}
        <Animated.View
          style={[styles.modalAnimatedContainer, fillContainer && styles.flex1]}
          exiting={Exiting}>
          <Animated.View
            style={[fillContainer && styles.flex1, animatedStyles]}
            // Only the content-sized slide path needs the measured size; other
            // types reveal without it, so skip the layout callback for them.
            onLayout={needsMeasuredSlide ? onContentLayout : undefined}>
            {props.children}
          </Animated.View>
        </Animated.View>
      </GestureHandler>
    </View>
  );
}

export default Container;
