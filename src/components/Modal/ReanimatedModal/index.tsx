import noop from 'lodash/noop';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {NativeEventSubscription, ViewStyle} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import {
  BackHandler,
  InteractionManager,
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import {LayoutAnimationConfig} from 'react-native-reanimated';
import FocusTrapForModal from '@components/FocusTrap/FocusTrapForModal';
import KeyboardAvoidingView from '@components/KeyboardAvoidingView';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import blurActiveElement from '@libs/Accessibility/blurActiveElement';
import getPlatform from '@libs/getPlatform';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import Backdrop from './Backdrop';
import Container from './Container';
import type ReanimatedModalProps from './types';

function ReanimatedModal({
  testID,
  animationInDelay,
  animationInTiming = CONST.MODAL.ANIMATION_TIMING.DEFAULT_IN,
  animationOutTiming = CONST.MODAL.ANIMATION_TIMING.DEFAULT_OUT,
  animationIn = 'fadeIn',
  animationOut = 'fadeOut',
  avoidKeyboard = false,
  coverScreen = true,
  children,
  hasBackdrop = true,
  backdropColor = 'black',
  backdropOpacity = variables.overlayOpacity,
  customBackdrop = null,
  isVisible = false,
  onModalWillShow = noop,
  onModalShow = noop,
  onModalWillHide = noop,
  onModalHide = noop,
  onDismiss,
  onBackdropPress = noop,
  onBackButtonPress = noop,
  style,
  type,
  statusBarTranslucent = false,
  onSwipeComplete,
  swipeDirection,
  swipeThreshold,
  shouldPreventScrollOnFocus,
  initialFocus,
  shouldIgnoreBackHandlerDuringTransition = false,
  shouldEnableNewFocusManagement,
  shouldReturnFocus,
  ...props
}: ReanimatedModalProps) {
  const [isVisibleState, setIsVisibleState] = useState(isVisible);
  const [isContainerOpen, setIsContainerOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const {windowHeight} = useWindowDimensions();

  const backHandlerListener = useRef<NativeEventSubscription | null>(null);
  const handleRef = useRef<number | undefined>(undefined);

  const styles = useThemeStyles();

  const onBackButtonPressHandler = useCallback(() => {
    if (shouldIgnoreBackHandlerDuringTransition && isTransitioning) {
      return false;
    }
    if (isVisibleState) {
      onBackButtonPress();
      return true;
    }
    return false;
  }, [
    isVisibleState,
    onBackButtonPress,
    isTransitioning,
    shouldIgnoreBackHandlerDuringTransition,
  ]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || onBackButtonPressHandler() !== true) {
        return;
      }
      e.stopImmediatePropagation();
    },
    [onBackButtonPressHandler],
  );

  useEffect(() => {
    if (getPlatform() === CONST.PLATFORM.WEB) {
      document.body.addEventListener('keyup', handleEscape, {capture: true});
    } else {
      backHandlerListener.current = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackButtonPressHandler,
      );
    }

    return () => {
      if (getPlatform() === CONST.PLATFORM.WEB) {
        document.body.removeEventListener('keyup', handleEscape, {
          capture: true,
        });
      } else {
        backHandlerListener.current?.remove();
      }
    };
  }, [handleEscape, onBackButtonPressHandler]);

  useEffect(
    () => () => {
      if (handleRef.current) {
        InteractionManager.clearInteractionHandle(handleRef.current);
      }

      setIsVisibleState(false);
      setIsContainerOpen(false);
    },

    [],
  );

  useEffect(() => {
    if (isVisible && !isContainerOpen && !isTransitioning) {
      handleRef.current = InteractionManager.createInteractionHandle();
      onModalWillShow();

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisibleState(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTransitioning(true);
    } else if (!isVisible && isContainerOpen && !isTransitioning) {
      handleRef.current = InteractionManager.createInteractionHandle();
      onModalWillHide();

      blurActiveElement();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisibleState(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTransitioning(true);
    }
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [isVisible, isContainerOpen, isTransitioning]);

  const backdropStyle: ViewStyle = useMemo(
    () => ({
      // Fill the real window rather than `windowWidth`. On web above the
      // responsive breakpoint the app renders inside a centered ~480px "phone
      // frame" and `windowWidth` is clamped to it (index.web.js), but the modal
      // portals to `document.body` outside that frame — a 480px backdrop would
      // dim only the left of the window and leave the rest of the overlay
      // uncovered. `'100%'` fills the portal's full-window container and is a
      // no-op on native and narrow web, where it already equals `windowWidth`.
      width: '100%',
      height: windowHeight,
      backgroundColor: backdropColor,
    }),
    [windowHeight, backdropColor],
  );

  const onOpenCallBack = useCallback(() => {
    setIsTransitioning(false);
    setIsContainerOpen(true);
    if (handleRef.current) {
      InteractionManager.clearInteractionHandle(handleRef.current);
    }
    onModalShow();
  }, [onModalShow]);

  const onCloseCallBack = useCallback(() => {
    setIsTransitioning(false);
    setIsContainerOpen(false);
    if (handleRef.current) {
      InteractionManager.clearInteractionHandle(handleRef.current);
    }

    // Because on Android, the Modal's onDismiss callback does not work reliably. There's a reported issue at:
    // https://stackoverflow.com/questions/58937956/react-native-modal-ondismiss-not-invoked
    // Therefore, we manually call onModalHide() here for Android.
    if (getPlatform() === CONST.PLATFORM.ANDROID) {
      onModalHide();
    }
  }, [onModalHide]);

  const modalStyle = useMemo(
    () => ({zIndex: StyleSheet.flatten(style)?.zIndex}),
    [style],
  );

  const containerView = (
    <Container
      pointerEvents="box-none"
      animationInTiming={animationInTiming}
      animationOutTiming={animationOutTiming}
      animationInDelay={animationInDelay}
      onOpenCallBack={onOpenCallBack}
      onCloseCallBack={onCloseCallBack}
      animationIn={animationIn}
      animationOut={animationOut}
      style={style}
      type={type}
      onSwipeComplete={onSwipeComplete}
      swipeDirection={swipeDirection}>
      {children}
    </Container>
  );

  const backdropView = (
    <Backdrop
      isBackdropVisible={isVisible}
      style={backdropStyle}
      customBackdrop={customBackdrop}
      onBackdropPress={onBackdropPress}
      animationInTiming={animationInTiming}
      animationOutTiming={animationOutTiming}
      animationInDelay={animationInDelay}
      backdropOpacity={backdropOpacity}
      // A bottom-docked sheet slides up while it's still off-screen, so a
      // backdrop that fades from transparent leaves the first frame uncovered
      // and the native iOS modal window shows through it as a one-frame flash
      // (#813). Cover immediately for this type; other types fill that frame
      // with their own content, so they keep the fade-in.
      shouldShowImmediately={type === CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED}
    />
  );

  if (!coverScreen && isVisibleState) {
    return (
      <View
        pointerEvents="box-none"
        style={[styles.modalBackdrop, styles.modalContainerBox]}>
        {hasBackdrop && backdropView}
        {containerView}
      </View>
    );
  }
  const isBackdropMounted =
    isVisibleState ||
    ((isTransitioning || isContainerOpen !== isVisibleState) &&
      getPlatform() === CONST.PLATFORM.WEB);
  const modalVisibility =
    isVisibleState || isTransitioning || isContainerOpen !== isVisibleState;
  return (
    <LayoutAnimationConfig skipExiting={getPlatform() !== CONST.PLATFORM.WEB}>
      <Modal
        transparent
        animationType="none"
        visible={modalVisibility}
        onRequestClose={onBackButtonPressHandler}
        statusBarTranslucent={statusBarTranslucent}
        testID={testID}
        onDismiss={() => {
          onDismiss?.();
          if (getPlatform() !== CONST.PLATFORM.ANDROID) {
            onModalHide();
          }
        }}
        style={modalStyle}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}>
        {isBackdropMounted && hasBackdrop && backdropView}
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior="padding"
            pointerEvents="box-none"
            style={[style, {margin: 0}]}>
            {isVisibleState && containerView}
          </KeyboardAvoidingView>
        ) : (
          <FocusTrapForModal
            active={modalVisibility}
            initialFocus={initialFocus}>
            {isVisibleState && containerView}
          </FocusTrapForModal>
        )}
      </Modal>
    </LayoutAnimationConfig>
  );
}

export default ReanimatedModal;
