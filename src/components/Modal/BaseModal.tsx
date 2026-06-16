import {PortalHost} from '@gorhom/portal';
import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import ColorSchemeWrapper from '@components/ColorSchemeWrapper';
import useKeyboardState from '@hooks/useKeyboardState';
import usePrevious from '@hooks/usePrevious';
import useSafeAreaInsets from '@hooks/useSafeAreaInsets';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import ComposerFocusManager from '@libs/ComposerFocusManager';
import Overlay from '@libs/Navigation/AppNavigator/Navigators/Overlay';
import variables from '@styles/variables';
import * as Modal from '@userActions/Modal';
import CONST from '@src/CONST';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import ModalContext from './ModalContext';
import ReanimatedModal from './ReanimatedModal';
import type {AnimationIn, AnimationOut} from './ReanimatedModal/types';
import type BaseModalProps from './types';

// iOS 26 ships native Liquid Glass; older iOS and Android do not. The value is
// fixed for the session, so it's evaluated once at module load (mirrors
// `BottomTabNavigator`).
const SUPPORTS_LIQUID_GLASS = isLiquidGlassAvailable();

const SUPPORTED_ANIMATIONS_IN: AnimationIn[] = [
  'fadeIn',
  'slideInUp',
  'slideInRight',
];
const SUPPORTED_ANIMATIONS_OUT: AnimationOut[] = [
  'fadeOut',
  'slideOutDown',
  'slideOutRight',
];

/**
 * Coerce the broad `react-native-modal` animation value (which may also be a
 * custom animation object, e.g. for RIGHT_DOCKED modals) into one of the
 * keyframe animations supported by ReanimatedModal.
 */
function resolveAnimationIn(
  animation: BaseModalProps['animationIn'],
): AnimationIn {
  if (
    typeof animation === 'string' &&
    SUPPORTED_ANIMATIONS_IN.includes(animation as AnimationIn)
  ) {
    return animation as AnimationIn;
  }
  return 'slideInRight';
}

function resolveAnimationOut(
  animation: BaseModalProps['animationOut'],
): AnimationOut {
  if (
    typeof animation === 'string' &&
    SUPPORTED_ANIMATIONS_OUT.includes(animation as AnimationOut)
  ) {
    return animation as AnimationOut;
  }
  return 'slideOutRight';
}

function BaseModal(
  {
    isVisible,
    onClose,
    shouldSetModalVisibility = true,
    onModalHide = () => {},
    type,
    popoverAnchorPosition = {},
    innerContainerStyle = {},
    outerStyle,
    onModalShow = () => {},
    fullscreen = true,
    animationIn,
    animationOut,
    hideModalContentWhileAnimating = false,
    animationInTiming,
    animationOutTiming,
    statusBarTranslucent = true,
    onLayout,
    avoidKeyboard = false,
    children,
    shouldUseCustomBackdrop = false,
    onBackdropPress,
    modalId,
    shouldEnableNewFocusManagement = false,
    restoreFocusType,
    shouldUseModalPaddingStyle = true,
    initialFocus = false,
    shouldUseGlassBackground = false,
  }: BaseModalProps,
  ref: React.ForwardedRef<View>,
) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {windowWidth, windowHeight} = useWindowDimensions();
  // We need to use isSmallScreenWidth instead of shouldUseNarrowLayout to apply correct modal width
  // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
  const {isSmallScreenWidth} = useResponsiveLayout();
  const keyboardStateContextValue = useKeyboardState();

  const safeAreaInsets = useSafeAreaInsets();

  const isVisibleRef = useRef(isVisible);
  const wasVisible = usePrevious(isVisible);

  const uniqueModalId = useMemo(
    () => modalId ?? ComposerFocusManager.getId(),
    [modalId],
  );
  const saveFocusState = useCallback(() => {
    if (shouldEnableNewFocusManagement) {
      ComposerFocusManager.saveFocusState(uniqueModalId);
    }
    ComposerFocusManager.resetReadyToFocus(uniqueModalId);
  }, [shouldEnableNewFocusManagement, uniqueModalId]);

  /**
   * Hides modal
   * @param callHideCallback - Should we call the onModalHide callback
   */
  const hideModal = useCallback(
    (callHideCallback = true) => {
      if (Modal.areAllModalsHidden()) {
        Modal.willAlertModalBecomeVisible(false);
        if (shouldSetModalVisibility) {
          Modal.setModalVisibility(false);
        }
      }
      if (callHideCallback) {
        onModalHide();
      }
      Modal.onModalDidClose();
      ComposerFocusManager.refocusAfterModalFullyClosed(
        uniqueModalId,
        restoreFocusType,
      );
    },
    [shouldSetModalVisibility, onModalHide, restoreFocusType, uniqueModalId],
  );

  useEffect(() => {
    isVisibleRef.current = isVisible;
    let removeOnCloseListener: () => void;
    if (isVisible) {
      Modal.willAlertModalBecomeVisible(
        true,
        type === CONST.MODAL.MODAL_TYPE.POPOVER ||
          type === CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED,
      );
      // To handle closing any modal already visible when this modal is mounted, i.e. PopoverReportActionContextMenu
      removeOnCloseListener = Modal.setCloseModal(onClose);
    }

    return () => {
      if (!removeOnCloseListener) {
        return;
      }
      removeOnCloseListener();
    };
  }, [isVisible, wasVisible, onClose, type]);

  useEffect(
    () => () => {
      // Only trigger onClose and setModalVisibility if the modal is unmounting while visible.
      if (!isVisibleRef.current) {
        return;
      }
      hideModal(true);
    },
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    [],
  );

  const handleShowModal = () => {
    if (shouldSetModalVisibility) {
      Modal.setModalVisibility(true);
    }
    onModalShow();
  };

  const handleBackdropPress = (e?: KeyboardEvent) => {
    if (e?.key === CONST.KEYBOARD_SHORTCUTS.ENTER.shortcutKey) {
      return;
    }

    if (onBackdropPress) {
      onBackdropPress();
    } else {
      onClose();
    }
  };

  const handleDismissModal = () => {
    ComposerFocusManager.setReadyToFocus(uniqueModalId);
  };

  const {
    modalStyle,
    modalContainerStyle,
    swipeDirection,
    animationIn: modalStyleAnimationIn,
    animationOut: modalStyleAnimationOut,
    shouldAddTopSafeAreaMargin,
    shouldAddBottomSafeAreaMargin,
    shouldAddTopSafeAreaPadding,
    shouldAddBottomSafeAreaPadding,
    hideBackdrop,
  } = useMemo(
    () =>
      StyleUtils.getModalStyles(
        type,
        {
          windowWidth,
          windowHeight,
          isSmallScreenWidth,
        },
        popoverAnchorPosition,
        innerContainerStyle,
        outerStyle,
      ),
    [
      StyleUtils,
      type,
      windowWidth,
      windowHeight,
      isSmallScreenWidth,
      popoverAnchorPosition,
      innerContainerStyle,
      outerStyle,
    ],
  );

  const {
    paddingTop: safeAreaPaddingTop,
    paddingBottom: safeAreaPaddingBottom,
    paddingLeft: safeAreaPaddingLeft,
    paddingRight: safeAreaPaddingRight,
  } = StyleUtils.getSafeAreaPadding(safeAreaInsets);

  const modalPaddingStyles = shouldUseModalPaddingStyle
    ? StyleUtils.getModalPaddingStyles({
        safeAreaPaddingTop,
        safeAreaPaddingBottom,
        safeAreaPaddingLeft,
        safeAreaPaddingRight,
        shouldAddBottomSafeAreaMargin,
        shouldAddTopSafeAreaMargin,
        shouldAddBottomSafeAreaPadding:
          !keyboardStateContextValue?.isKeyboardShown &&
          shouldAddBottomSafeAreaPadding,
        shouldAddTopSafeAreaPadding,
        modalContainerStyleMarginTop: modalContainerStyle.marginTop,
        modalContainerStyleMarginBottom: modalContainerStyle.marginBottom,
        modalContainerStylePaddingTop: modalContainerStyle.paddingTop,
        modalContainerStylePaddingBottom: modalContainerStyle.paddingBottom,
        insets: safeAreaInsets,
      })
    : {
        paddingLeft: safeAreaPaddingLeft ?? 0,
        paddingRight: safeAreaPaddingRight ?? 0,
      };

  const modalContextValue = useMemo(
    () => ({
      activeModalType: isVisible ? type : undefined,
    }),
    [isVisible, type],
  );

  // When the caller opts into glass and the device supports Liquid Glass, drop
  // the opaque container fill so the native glass surface shows through, and for
  // POPOVER also drop the border/drop-shadow — those double up with the glass's
  // own edge and render incorrectly around a now-transparent native view. The
  // container keeps its `borderRadius` + `overflow: 'hidden'`, which clips the
  // glass to the rounded corners.
  const useGlass = shouldUseGlassBackground && SUPPORTS_LIQUID_GLASS;
  const glassContainerOverride = useGlass
    ? {
        backgroundColor: theme.transparent,
        borderWidth: 0,
        boxShadow: undefined,
      }
    : undefined;

  return (
    <ModalContext.Provider value={modalContextValue}>
      <View
        // this is a workaround for modal not being visible on the new arch in some cases
        // it's necessary to have a non-collapseable view as a parent of the modal to prevent
        // a conflict between RN core and Reanimated shadow tree operations
        // position absolute is needed to prevent the view from interfering with flex layout
        collapsable={false}
        style={[styles.pAbsolute, {zIndex: 1}]}>
        <ReanimatedModal
          // Prevent the parent element to capture a click. This is useful when the modal component is put inside a pressable.
          onClick={e => e.stopPropagation()}
          onBackdropPress={handleBackdropPress}
          // Note: Escape key on web/desktop will trigger onBackButtonPress callback
          // eslint-disable-next-line react/jsx-props-no-multi-spaces
          onBackButtonPress={Modal.closeTop}
          onModalShow={handleShowModal}
          onModalHide={hideModal}
          onModalWillShow={saveFocusState}
          onModalWillHide={() => {
            // Reset willAlertModalBecomeVisible when modal is about to hide
            // This ensures it's cleared before any other components check its value
            if (Modal.areAllModalsHidden()) {
              Modal.willAlertModalBecomeVisible(false);
            }
          }}
          onDismiss={handleDismissModal}
          onSwipeComplete={() => onClose?.()}
          swipeDirection={swipeDirection}
          isVisible={isVisible}
          backdropColor={theme.overlay}
          backdropOpacity={
            !shouldUseCustomBackdrop && hideBackdrop
              ? 0
              : variables.overlayOpacity
          }
          backdropTransitionOutTiming={0}
          hasBackdrop={fullscreen}
          coverScreen={fullscreen}
          style={modalStyle}
          deviceHeight={windowHeight}
          deviceWidth={windowWidth}
          animationIn={resolveAnimationIn(animationIn ?? modalStyleAnimationIn)}
          animationOut={resolveAnimationOut(
            animationOut ?? modalStyleAnimationOut,
          )}
          hideModalContentWhileAnimating={hideModalContentWhileAnimating}
          animationInTiming={animationInTiming}
          animationOutTiming={animationOutTiming}
          statusBarTranslucent={statusBarTranslucent}
          onLayout={onLayout}
          avoidKeyboard={avoidKeyboard}
          customBackdrop={
            shouldUseCustomBackdrop ? (
              <Overlay onPress={handleBackdropPress} />
            ) : undefined
          }
          type={type}
          initialFocus={initialFocus}
          shouldEnableNewFocusManagement={shouldEnableNewFocusManagement}>
          <Animated.View
            style={[
              styles.defaultModalContainer,
              modalContainerStyle,
              modalPaddingStyles,
              glassContainerOverride,
              !isVisible && styles.pointerEventsNone,
              // TEMP DEBUG #813: tint the sheet's own surface GREEN so we can
              // tell if the brightening is the content (a green bottom strip)
              // vs the backdrop (red) vs the native window (white). REMOVE
              // before merge.
              {backgroundColor: 'lime'},
            ]}
            ref={ref}>
            {useGlass && (
              <GlassView
                style={StyleSheet.absoluteFill}
                glassEffectStyle="regular"
                colorScheme={theme.colorScheme}
              />
            )}
            <ColorSchemeWrapper>{children}</ColorSchemeWrapper>
            <PortalHost name="modal" />
          </Animated.View>
        </ReanimatedModal>
      </View>
    </ModalContext.Provider>
  );
}

BaseModal.displayName = 'BaseModalWithRef';

export default forwardRef(BaseModal);
