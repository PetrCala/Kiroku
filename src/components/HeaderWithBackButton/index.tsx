import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';
import React, {useMemo} from 'react';
import {Keyboard, StyleSheet, View} from 'react-native';
import Avatar from '@components/Avatar';
import Header from '@components/Header';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
// import PinButton from '@components/PinButton';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import ThreeDotsMenu from '@components/ThreeDotsMenu';
import Tooltip from '@components/Tooltip';
import useKeyboardState from '@hooks/useKeyboardState';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useThrottledButtonState from '@hooks/useThrottledButtonState';
import getButtonState from '@libs/getButtonState';
import Navigation from '@libs/Navigation/Navigation';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import type HeaderWithBackButtonProps from './types';

// iOS 26 ships native Liquid Glass; older iOS and Android do not. The value is
// fixed for the session, so it's evaluated once at module load.
const SUPPORTS_LIQUID_GLASS = isLiquidGlassAvailable();

function HeaderWithBackButton({
  icon,
  iconFill,
  onBackButtonPress = () => Navigation.goBack(),
  onCloseButtonPress = () => Navigation.dismissModal(),
  onDownloadButtonPress = () => {},
  onThreeDotsButtonPress = () => {},
  avatar,
  shouldShowBackButton = true,
  shouldAlignTitleStart = false,
  shouldShowBorderBottom = false,
  shouldShowCloseButton = false,
  shouldShowDownloadButton = false,
  shouldShowGetAssistanceButton = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  shouldDisableGetAssistanceButton = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  shouldShowPinButton = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  shouldSetModalVisibility = true,
  shouldShowThreeDotsButton = false,
  shouldDisableThreeDotsButton = false,
  subtitle = '',
  title = '',
  titleColor,
  threeDotsAnchorPosition = {
    vertical: 0,
    horizontal: 0,
  },
  threeDotsMenuItems = [],
  shouldEnableDetailPageNavigation = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  children = null,
  customRightButton = null,
  shouldOverlayDots = false,
  shouldOverlay = false,
  shouldNavigateToTopMostReport = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  progressBarPercentage,
  style,
  shouldUseGlassBackground = false,
}: HeaderWithBackButtonProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const [isDownloadButtonActive, temporarilyDisableDownloadButton] =
    useThrottledButtonState();
  const {translate} = useLocalize();
  const {isKeyboardShown} = useKeyboardState();

  // If the icon is present, the header bar should be taller and use different font.
  const isCentralPaneSettings = !!icon;

  const middleContent = useMemo(() => {
    if (progressBarPercentage) {
      return (
        <>
          {/* Reserves as much space for the middleContent as possible */}
          <View style={styles.flexGrow1} />
          {/* Uses absolute positioning so that it's always centered instead of being affected by the
                    presence or absence of back/close buttons to the left/right of it */}
          <View style={styles.headerProgressBarContainer}>
            <View style={styles.headerProgressBar}>
              <View
                style={[
                  {width: `${progressBarPercentage}%`},
                  styles.headerProgressBarFill,
                ]}
              />
            </View>
          </View>
        </>
      );
    }

    return (
      <Header
        title={title}
        subtitle={subtitle}
        textStyles={[
          titleColor ? StyleUtils.getTextColorStyle(titleColor) : {},
          isCentralPaneSettings && styles.textHeadlineH2,
        ]}
        // Default end-alignment parks the title by the right-side actions;
        // `shouldAlignTitleStart` keeps it next to the back button instead.
        containerStyles={
          shouldAlignTitleStart ? undefined : styles.justifyContentEnd
        }
      />
    );
  }, [
    StyleUtils,
    isCentralPaneSettings,
    progressBarPercentage,
    shouldAlignTitleStart,
    styles.flexGrow1,
    styles.headerProgressBar,
    styles.headerProgressBarContainer,
    styles.headerProgressBarFill,
    styles.textHeadlineH2,
    styles.justifyContentEnd,
    subtitle,
    title,
    titleColor,
  ]);

  return (
    <View
      // Hover on some part of close icons will not work on Electron if dragArea is true
      // https://github.com/Expensify/App/issues/29598
      dataSet={{dragArea: false}}
      style={[
        styles.headerBar,
        isCentralPaneSettings && styles.headerBarDesktopHeight,
        shouldShowBorderBottom && styles.borderBottom,
        // progressBarPercentage can be 0 which would
        // be falsey, hence using !== undefined explicitly
        progressBarPercentage !== undefined && styles.pl0,
        shouldShowBackButton && [styles.pl2, styles.pr2],
        shouldOverlay && StyleSheet.absoluteFillObject,
        style,
      ]}>
      {shouldUseGlassBackground && SUPPORTS_LIQUID_GLASS && (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          colorScheme={theme.colorScheme}
        />
      )}
      <View
        style={[
          styles.dFlex,
          styles.flexRow,
          styles.alignItemsCenter,
          styles.flexGrow1,
          styles.justifyContentBetween,
          styles.overflowHidden,
        ]}>
        {shouldShowBackButton && (
          <Tooltip text={translate('common.back')}>
            <PressableWithoutFeedback
              onPress={() => {
                if (isKeyboardShown) {
                  Keyboard.dismiss();
                }
                onBackButtonPress();
              }}
              style={[styles.touchableButtonImage]}
              role="button"
              accessibilityLabel={translate('common.back')}
              nativeID={CONST.BACK_BUTTON_NATIVE_ID}>
              <Icon
                src={KirokuIcons.BackArrow}
                width={variables.iconBottomBar}
                height={variables.iconBottomBar}
                fill={iconFill ?? theme.heading}
              />
            </PressableWithoutFeedback>
          </Tooltip>
        )}
        {icon && (
          <Icon
            src={icon}
            width={variables.iconHeader}
            height={variables.iconHeader}
            additionalStyles={[styles.mr2]}
          />
        )}
        {avatar && (
          <Avatar
            containerStyles={[
              StyleUtils.getWidthAndHeightStyle(
                StyleUtils.getAvatarSize(CONST.AVATAR_SIZE.DEFAULT),
              ),
              styles.mr3,
            ]}
            source={avatar?.source}
            name={avatar?.name}
            type={avatar?.type}
          />
        )}
        {middleContent}
        <View style={[styles.flexRow, styles.pr5, styles.alignItemsCenter]}>
          {children}
          {shouldShowDownloadButton && (
            <Tooltip text={translate('common.download')}>
              <PressableWithoutFeedback
                onPress={event => {
                  // Blur the pressable in case this button triggers a Growl notification
                  // We do not want to overlap Growl with the Tooltip (#15271)
                  (event?.currentTarget as HTMLElement)?.blur();

                  if (!isDownloadButtonActive) {
                    return;
                  }

                  onDownloadButtonPress();
                  temporarilyDisableDownloadButton();
                }}
                style={[styles.touchableButtonImage]}
                role="button"
                accessibilityLabel={translate('common.download')}>
                <Icon
                  src={KirokuIcons.Download}
                  fill={
                    iconFill ??
                    StyleUtils.getIconFillColor(
                      getButtonState(false, false, !isDownloadButtonActive),
                    )
                  }
                />
              </PressableWithoutFeedback>
            </Tooltip>
          )}
          {/* {shouldShowGetAssistanceButton && (
            <Tooltip
              text={translate('getAssistancePage.questionMarkButtonTooltip')}>
              <PressableWithoutFeedback
                disabled={shouldDisableGetAssistanceButton}
                onPress={
                  () => console.log('Get Assistance Button Pressed')
                  // TODO implement this
                  //   Navigation.navigate(
                  //     ROUTES.GET_ASSISTANCE.getRoute(
                  //       guidesCallTaskID,
                  //       Navigation.getActiveRoute(),
                  //     ),
                  //   )
                }
                style={[styles.touchableButtonImage]}
                role="button"
                accessibilityLabel={translate(
                  'getAssistancePage.questionMarkButtonTooltip',
                )}>
                <Icon
                  src={Expensicons.QuestionMark}
                  fill={iconFill ?? theme.icon}
                />
              </PressableWithoutFeedback>
            </Tooltip>
          )} */}
          {/* {shouldShowPinButton && !!report && <PinButton report={report} />} */}
          {shouldShowThreeDotsButton && (
            <ThreeDotsMenu
              disabled={shouldDisableThreeDotsButton}
              menuItems={threeDotsMenuItems}
              onIconPress={onThreeDotsButtonPress}
              anchorPosition={threeDotsAnchorPosition}
              shouldOverlay={shouldOverlayDots}
              shouldSetModalVisibility={shouldSetModalVisibility}
            />
          )}
          {shouldShowCloseButton && (
            <Tooltip text={translate('common.close')}>
              <PressableWithoutFeedback
                onPress={onCloseButtonPress}
                style={[styles.touchableButtonImage]}
                role={CONST.ROLE.BUTTON}
                accessibilityLabel={translate('common.close')}>
                <Icon src={KirokuIcons.Close} fill={iconFill ?? theme.icon} />
              </PressableWithoutFeedback>
            </Tooltip>
          )}
          {customRightButton && customRightButton}
        </View>
      </View>
    </View>
  );
}

HeaderWithBackButton.displayName = 'HeaderWithBackButton';

export default HeaderWithBackButton;
