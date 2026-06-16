import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type {BackdropProps} from '@components/Modal/ReanimatedModal/types';
import {
  easing,
  getModalOutAnimation,
} from '@components/Modal/ReanimatedModal/utils';
import {PressableWithoutFeedback} from '@components/Pressable';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import CONST from '@src/CONST';

function Backdrop({
  style,
  customBackdrop,
  onBackdropPress,
  animationInTiming = CONST.MODAL.ANIMATION_TIMING.DEFAULT_IN,
  animationOutTiming = CONST.MODAL.ANIMATION_TIMING.DEFAULT_OUT,
  backdropOpacity = variables.overlayOpacity,
  shouldShowImmediately = false,
}: BackdropProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  // When covering immediately, the dim starts at full strength (progress 1) so
  // the first painted frame already hides whatever is behind the backdrop.
  const initProgress = useSharedValue(shouldShowImmediately ? 1 : 0);
  const isInitiated = useSharedValue(false);

  // Reveal via a shared value + useAnimatedStyle (progress=0 applied on mount)
  // instead of an `entering` Keyframe, whose `from` frame isn't applied before
  // the first paint on the New Architecture — that flashed the dim backdrop at
  // full opacity for a frame before the fade.
  useEffect(() => {
    if (isInitiated.get() || shouldShowImmediately) {
      return;
    }
    isInitiated.set(true);
    initProgress.set(
      withTiming(1, {
        duration: animationInTiming,
        easing,
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [animationInTiming, initProgress, isInitiated, shouldShowImmediately]);

  const animatedStyles = useAnimatedStyle(
    () => ({opacity: initProgress.get()}),
    [initProgress],
  );

  const Exiting = new Keyframe(getModalOutAnimation('fadeOut'))
    .duration(animationOutTiming)
    .reduceMotion(ReduceMotion.Never);

  // The reveal opacity (0->1) lives on the inner Animated.View; the dim color and
  // its target opacity live on a plain fill child, so the two compose to a
  // 0 -> backdropOpacity fade and the surface paints reliably.
  const {backgroundColor, ...frame} =
    StyleSheet.flatten([styles.modalBackdrop, style]) ?? {};

  // The exiting (fadeOut) layout animation lives on the OUTER wrapper, which
  // carries no opacity of its own; the reveal opacity (`animatedStyles`) lives on
  // the inner view. Keeping the layout animation and the animated opacity on
  // separate elements avoids Reanimated's "Property "opacity" may be overwritten
  // by a layout animation" dev warning.
  const BackdropOverlay = (
    <Animated.View style={frame} exiting={Exiting}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyles]}>
        {customBackdrop ?? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor, opacity: backdropOpacity},
            ]}
          />
        )}
      </Animated.View>
    </Animated.View>
  );

  if (!customBackdrop) {
    return (
      <PressableWithoutFeedback
        accessible
        accessibilityLabel={translate('modal.backdropLabel')}
        onPressIn={onBackdropPress}>
        {BackdropOverlay}
      </PressableWithoutFeedback>
    );
  }

  return BackdropOverlay;
}

export default Backdrop;
