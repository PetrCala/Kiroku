import React from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {Keyframe} from 'react-native-reanimated';
import type {BackdropProps} from '@components/Modal/ReanimatedModal/types';
import {
  getModalInAnimation,
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
}: BackdropProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const Entering = new Keyframe(getModalInAnimation('fadeIn')).duration(
    animationInTiming,
  );
  const Exiting = new Keyframe(getModalOutAnimation('fadeOut')).duration(
    animationOutTiming,
  );

  // The shared fadeIn/fadeOut keyframe animates opacity 0<->1 (so modal content
  // rests fully opaque). The backdrop's dimness is a separate concern, so its
  // target opacity lives on the fill child while the Animated.View just drives
  // the reveal — the two compose to a 0 -> backdropOpacity fade.
  const {backgroundColor, ...frame} =
    StyleSheet.flatten([styles.modalBackdrop, style]) ?? {};

  const BackdropOverlay = (
    <Animated.View entering={Entering} exiting={Exiting} style={frame}>
      {customBackdrop ?? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor, opacity: backdropOpacity},
          ]}
        />
      )}
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
