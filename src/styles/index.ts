/* eslint-disable @typescript-eslint/naming-convention */
import lodashClamp from 'lodash/clamp';
import type {LineLayer} from 'react-map-gl';
import {
  Platform,
  type AnimatableNumericValue,
  type Animated,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type {PickerStyle} from 'react-native-picker-select';
import type {CustomAnimation} from 'react-native-animatable';
import type {
  MixedStyleDeclaration,
  MixedStyleRecord,
} from 'react-native-render-html';
import * as Browser from '@libs/Browser';
import CONST from '@src/CONST';
import {defaultTheme} from './theme';
import colors from './theme/colors';
import type {ThemeColors} from './theme/types';
// import addOutlineWidth from './utils/addOutlineWidth';
import borders from './utils/borders';
import codeStyles from './utils/codeStyles';
import cursor from './utils/cursor';
import display from './utils/display';
import editedLabelStyles from './utils/editedLabelStyles';
import flex from './utils/flex';
import FontUtils from './utils/FontUtils';
// import getPopOverVerticalOffset from './utils/getPopOverVerticalOffset';
// import objectFit from './utils/objectFit';
// import optionAlternateTextPlatformStyles from './utils/optionAlternateTextPlatformStyles';
import overflow from './utils/overflow';
import pointerEventsAuto from './utils/pointerEventsAuto';
import pointerEventsBoxNone from './utils/pointerEventsBoxNone';
import pointerEventsNone from './utils/pointerEventsNone';
import positioning from './utils/positioning';
import sizing from './utils/sizing';
import spacing from './utils/spacing';
import addOutlineWidth from './utils/addOutlineWidth';
// import textDecorationLine from './utils/textDecorationLine';
// import textUnderline from './utils/textUnderline';
import userSelect from './utils/userSelect';
import visibility from './utils/visibility';
import whiteSpace from './utils/whiteSpace';
import wordBreak from './utils/wordBreak';
import writingDirection from './utils/writingDirection';
import variables from './variables';

type ColorScheme = (typeof CONST.COLOR_SCHEME)[keyof typeof CONST.COLOR_SCHEME];
type StatusBarStyle =
  (typeof CONST.STATUS_BAR_STYLE)[keyof typeof CONST.STATUS_BAR_STYLE];

type AnchorDimensions = {
  width: number;
  height: number;
};

type AnchorPosition = {
  horizontal: number;
  vertical: number;
};

type WebViewStyle = {
  tagStyles: MixedStyleRecord;
  baseFontStyle: MixedStyleDeclaration;
};

type CustomPickerStyle = PickerStyle & {icon?: ViewStyle};

type OverlayStylesParams = {
  progress: Animated.AnimatedInterpolation<string | number>;
};

type TwoFactorAuthCodesBoxParams = {
  isExtraSmallScreenWidth: boolean;
  isSmallScreenWidth: boolean;
};

type Translation =
  | 'perspective'
  | 'rotate'
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ'
  | 'scale'
  | 'scaleX'
  | 'scaleY'
  | 'translateX'
  | 'translateY'
  | 'skewX'
  | 'skewY'
  | 'matrix';

type OfflineFeedbackStyle = Record<
  | 'deleted'
  | 'pending'
  | 'default'
  | 'error'
  | 'container'
  | 'textContainer'
  | 'text'
  | 'errorDot',
  ViewStyle | TextStyle
>;

type Styles = Record<
  string,
  | ViewStyle
  | TextStyle
  | ImageStyle
  | WebViewStyle
  | OfflineFeedbackStyle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ((
      ...args: any[]
    ) =>
      | ViewStyle
      | TextStyle
      | ImageStyle
      | AnchorPosition
      | CustomAnimation
      | CustomPickerStyle)
>;

// touchCallout is an iOS safari only property that controls the display of the callout information when you touch and hold a target
const touchCalloutNone: Pick<ViewStyle, 'WebkitTouchCallout'> =
  Browser.isMobileSafari() ? {WebkitTouchCallout: 'none'} : {};
// to prevent vertical text offset in Safari for badges, new lineHeight values have been added
const lineHeightBadge: Pick<ViewStyle, 'lineHeight'> = Browser.isSafari()
  ? {lineHeight: variables.lineHeightXSmall}
  : {lineHeight: variables.lineHeightNormal};

const picker = (theme: ThemeColors) =>
  ({
    backgroundColor: theme.transparent,
    color: theme.text,
    ...FontUtils.fontFamily.platform.EXP_NEUE,
    fontSize: variables.fontSizeNormal,
    lineHeight: variables.fontSizeNormalHeight,
    paddingBottom: 8,
    paddingTop: 23,
    paddingLeft: 0,
    paddingRight: 25,
    height: variables.inputHeight,
    borderWidth: 0,
    textAlign: 'left',
  }) satisfies TextStyle;

const link = (theme: ThemeColors) =>
  ({
    color: theme.link,
    textDecorationColor: theme.link,
    ...FontUtils.fontFamily.platform.EXP_NEUE,
  }) satisfies ViewStyle & MixedStyleDeclaration;

const baseCodeTagStyles = (theme: ThemeColors) =>
  ({
    borderWidth: 1,
    borderRadius: 5,
    borderColor: theme.border,
    backgroundColor: theme.textBackground,
  }) satisfies ViewStyle & MixedStyleDeclaration;

const headlineFont = {
  ...FontUtils.fontFamily.platform.EXP_NEW_KANSAS_MEDIUM,
  fontWeight: '500',
} satisfies TextStyle;

const modalNavigatorContainer = (isSmallScreenWidth: boolean) =>
  ({
    position: 'absolute',
    width: isSmallScreenWidth ? '100%' : variables.sideBarWidth,
    height: '100%',
  }) satisfies ViewStyle;

const webViewStyles = (theme: ThemeColors) =>
  ({
    // As of react-native-render-html v6, don't declare distinct styles for
    // custom renderers, the API for custom renderers has changed. Declare the
    // styles in the below "tagStyles" instead. If you need to reuse those
    // styles from the renderer, just pass the "style" prop to the underlying
    // component.
    tagStyles: {
      em: {
        ...FontUtils.fontFamily.platform.EXP_NEUE,
        fontStyle: 'italic',
      },

      del: {
        textDecorationLine: 'line-through',
        textDecorationStyle: 'solid',
      },

      strong: {
        ...FontUtils.fontFamily.platform.EXP_NEUE,
        fontWeight: 'bold',
      },

      a: link(theme),

      ul: {
        maxWidth: '100%',
      },

      ol: {
        maxWidth: '100%',
      },

      li: {
        flexShrink: 1,
      },

      blockquote: {
        borderLeftColor: theme.border,
        borderLeftWidth: 4,
        paddingLeft: 12,
        marginTop: 4,
        marginBottom: 4,

        // Overwrite default HTML margin for blockquotes
        marginLeft: 0,
      },

      pre: {
        ...baseCodeTagStyles(theme),
        paddingTop: 12,
        paddingBottom: 12,
        paddingRight: 8,
        paddingLeft: 8,
        ...FontUtils.fontFamily.platform.MONOSPACE,
        marginTop: 0,
        marginBottom: 0,
      },

      code: {
        ...baseCodeTagStyles(theme),
        ...(codeStyles.codeTextStyle as MixedStyleDeclaration),
        paddingLeft: 5,
        paddingRight: 5,
        ...FontUtils.fontFamily.platform.MONOSPACE,
        // Font size is determined by getCodeFontSize function in `StyleUtils.js`
      },

      img: {
        borderColor: theme.border,
        borderRadius: variables.componentBorderRadiusNormal,
        borderWidth: 1,
        ...touchCalloutNone,
      },

      video: {
        minWidth: CONST.VIDEO_PLAYER.MIN_WIDTH,
        minHeight: CONST.VIDEO_PLAYER.MIN_HEIGHT,
        borderRadius: variables.componentBorderRadiusNormal,
        overflow: 'hidden',
        backgroundColor: theme.highlightBG,
        ...touchCalloutNone,
      },

      p: {
        marginTop: 0,
        marginBottom: 0,
      },
      h1: {
        fontSize: variables.fontSizeLarge,
        marginBottom: 8,
      },
    },

    baseFontStyle: {
      color: theme.text,
      fontSize: variables.fontSizeNormal,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      flex: 1,
      lineHeight: variables.fontSizeNormalHeight,
      ...writingDirection.ltr,
    },
  }) satisfies WebViewStyle;

const styles = (theme: ThemeColors) =>
  ({
    // Add all of our utility and helper styles
    ...spacing,
    ...borders,
    ...sizing,
    ...flex,
    ...display,
    ...overflow,
    ...positioning,
    ...wordBreak,
    ...whiteSpace,
    ...writingDirection,
    ...cursor,
    ...userSelect,
    // ...textUnderline,
    // ...objectFit,
    // ...textDecorationLine,
    editedLabelStyles,

    accountSettingsSectionTitle: {
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
    },

    accountSettingsSectionContainer: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      ...spacing.mt0,
      ...spacing.mb0,
      ...spacing.pt0,
    },

    generalSettingsSectionContainer: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      ...spacing.pt4,
    },

    activeComponentBG: {
      backgroundColor: theme.activeComponentBG,
    },

    appContent: {
      backgroundColor: theme.appBG,
      overflow: 'hidden',
    },

    appContentHeader: {
      height: variables.contentHeaderHeight,
      justifyContent: 'center',
      display: 'flex',
      paddingRight: 20,
    },

    appContentHeaderTitle: {
      alignItems: 'center',
      flexDirection: 'row',
    },

    autoGrowHeightInputContainer: (
      textInputHeight: number,
      minHeight: number,
      maxHeight: number,
    ) =>
      ({
        height: lodashClamp(textInputHeight, minHeight, maxHeight),
        minHeight,
      }) satisfies ViewStyle,

    autoGrowHeightHiddenInput: (maxWidth: number, maxHeight?: number) =>
      ({
        maxWidth,
        maxHeight: maxHeight && maxHeight + 1,
        overflow: 'hidden',
      }) satisfies TextStyle,

    badge: {
      backgroundColor: theme.border,
      borderRadius: 14,
      height: variables.iconSizeNormal,
      flexDirection: 'row',
      paddingHorizontal: 7,
      alignItems: 'center',
    },

    badgeSuccess: {
      backgroundColor: theme.success,
    },

    badgeSuccessPressed: {
      backgroundColor: theme.successHover,
    },

    badgeAdHocSuccess: {
      backgroundColor: theme.badgeAdHoc,
    },

    badgeAdHocSuccessPressed: {
      backgroundColor: theme.badgeAdHocHover,
    },

    badgeDanger: {
      backgroundColor: theme.danger,
    },

    badgeDangerPressed: {
      backgroundColor: theme.dangerPressed,
    },

    badgeBordered: {
      backgroundColor: theme.transparent,
      borderWidth: 1,
      borderRadius: variables.componentBorderRadiusSmall,
      borderColor: theme.border,
      paddingHorizontal: 12,
      minHeight: 28,
    },

    badgeText: {
      color: theme.text,
      fontSize: variables.fontSizeSmall,
      ...lineHeightBadge,
      ...whiteSpace.noWrap,
    },

    bgTransparent: {
      backgroundColor: 'transparent',
    },

    bgDark: {
      backgroundColor: theme.inverse,
    },

    border: {
      borderWidth: 1,
      borderRadius: variables.componentBorderRadius,
      borderColor: theme.border,
    },

    borderColorFocus: {
      borderColor: theme.borderFocus,
    },

    borderColorDanger: {
      borderColor: theme.danger,
    },

    borderRadiusNormal: {
      borderRadius: variables.buttonBorderRadius,
    },

    borderTop: {
      borderTopWidth: variables.borderTopWidth,
      borderColor: theme.border,
    },

    borderTopRounded: {
      borderTopWidth: 1,
      borderColor: theme.border,
      borderTopLeftRadius: variables.componentBorderRadiusNormal,
      borderTopRightRadius: variables.componentBorderRadiusNormal,
    },

    borderBottomRounded: {
      borderBottomWidth: 1,
      borderColor: theme.border,
      borderBottomLeftRadius: variables.componentBorderRadiusNormal,
      borderBottomRightRadius: variables.componentBorderRadiusNormal,
    },

    borderBottom: {
      borderBottomWidth: 1,
      borderColor: theme.border,
    },

    borderNone: {
      borderWidth: 0,
      borderBottomWidth: 0,
    },

    borderRight: {
      borderRightWidth: 1,
      borderColor: theme.border,
    },

    borderLeft: {
      borderLeftWidth: 1,
      borderColor: theme.border,
    },

    bottomTabBarContainer: {
      flexDirection: 'row',
      height: variables.bottomTabHeight,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      // backgroundColor: theme.appBG, // TODO
      backgroundColor: colors.white,
    },

    bottomTabBarItem: {
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },

    boxShadowNone: {
      boxShadow: 'none',
    },

    button: {
      backgroundColor: theme.buttonDefaultBG,
      borderRadius: variables.buttonBorderRadius,
      minHeight: variables.componentSizeNormal,
      justifyContent: 'center',
      alignItems: 'center',
      ...spacing.ph3,
      ...spacing.pv0,
    },

    buttonContainer: {
      borderRadius: variables.buttonBorderRadius,
    },

    buttonText: {
      color: theme.text,
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      fontSize: variables.fontSizeNormal,
      textAlign: 'center',
      flexShrink: 1,

      // It is needed to unset the Lineheight. We don't need it for buttons as button always contains single line of text.
      // It allows to vertically center the text.
      lineHeight: undefined,

      // Add 1px to the Button text to give optical vertical alignment.
      paddingBottom: 1,
    },

    buttonSmall: {
      borderRadius: variables.buttonBorderRadius,
      minHeight: variables.componentSizeSmall,
      minWidth: variables.componentSizeSmall,
      paddingHorizontal: 12,
      backgroundColor: theme.buttonDefaultBG,
    },

    buttonMedium: {
      borderRadius: variables.buttonBorderRadius,
      minHeight: variables.componentSizeNormal,
      minWidth: variables.componentSizeNormal,
      paddingHorizontal: 16,
      backgroundColor: theme.buttonDefaultBG,
    },

    buttonLarge: {
      borderRadius: variables.buttonBorderRadius,
      minHeight: variables.componentSizeLarge,
      minWidth: variables.componentSizeLarge,
      paddingHorizontal: 20,
      backgroundColor: theme.buttonDefaultBG,
    },

    buttonSmallText: {
      fontSize: variables.fontSizeSmall,
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      textAlign: 'center',
    },

    buttonMediumText: {
      fontSize: variables.fontSizeLabel,
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      textAlign: 'center',
    },

    buttonLargeText: {
      fontSize: variables.fontSizeNormal,
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      textAlign: 'center',
    },

    buttonDefaultBG: {
      backgroundColor: theme.buttonDefaultBG,
    },

    buttonHoveredBG: {
      backgroundColor: theme.buttonHoveredBG,
    },

    buttonDefaultHovered: {
      backgroundColor: theme.buttonHoveredBG,
      borderWidth: 0,
    },

    buttonSuccess: {
      backgroundColor: theme.success,
      borderWidth: 0,
    },

    buttonOpacityDisabled: {
      opacity: 0.5,
    },

    buttonSuccessHovered: {
      backgroundColor: theme.successHover,
      borderWidth: 0,
    },

    buttonConfirmText: {
      paddingLeft: 20,
      paddingRight: 20,
    },

    buttonSuccessText: {
      color: theme.textDark,
    },

    buttonDangerText: {
      color: theme.textLight,
    },

    buttonDanger: {
      backgroundColor: theme.danger,
      borderWidth: 0,
    },

    buttonDangerHovered: {
      backgroundColor: theme.dangerHover,
      borderWidth: 0,
    },

    buttonDisabled: {
      backgroundColor: theme.buttonDefaultBG,
      borderWidth: 0,
    },

    buttonDivider: {
      borderRightWidth: 1,
      borderRightColor: theme.buttonHoveredBG,
      ...sizing.h100,
    },

    buttonSuccessDivider: {
      borderRightWidth: 1,
      borderRightColor: theme.successHover,
      ...sizing.h100,
    },

    buttonDangerDivider: {
      borderRightWidth: 1,
      borderRightColor: theme.dangerHover,
      ...sizing.h100,
    },

    calendarHeader: {
      height: 50,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingRight: 5,
      ...userSelect.userSelectNone,
    },

    calendarDayRoot: {
      flex: 1,
      height: 45,
      justifyContent: 'center',
      alignItems: 'center',
      ...userSelect.userSelectNone,
    },

    calendarDayContainer: {
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 15,
      overflow: 'hidden',
    },

    cardSectionContainer: {
      backgroundColor: theme.cardBG,
      borderRadius: variables.componentBorderRadiusCard,
      width: 'auto',
      textAlign: 'left',
      overflow: 'hidden',
      marginBottom: 20,
      marginHorizontal: variables.sectionMargin,
    },

    cardSectionIllustration: {
      width: 'auto',
      height: variables.sectionIllustrationHeight,
    },

    cardStyleNavigator: {
      overflow: 'hidden',
      height: '100%',
    },

    cardSectionTitle: {
      fontSize: variables.fontSizeLarge,
      lineHeight: variables.lineHeightXLarge,
    },

    centeredModalStyles: (
      isSmallScreenWidth: boolean,
      isFullScreenWhenSmall: boolean,
    ) =>
      ({
        borderWidth: isSmallScreenWidth && !isFullScreenWhenSmall ? 1 : 0,
        marginHorizontal: isSmallScreenWidth ? 0 : 20,
      }) satisfies ViewStyle,

    colorSchemeStyle: (colorScheme: ColorScheme) => ({colorScheme}),

    checkedContainer: {
      backgroundColor: theme.checkBox,
    },

    colorMutedReversed: {
      color: theme.textMutedReversed,
    },

    colorMuted: {
      color: theme.textSupporting,
    },

    contextMenuItemPopoverMaxWidth: {
      maxWidth: 375,
    },

    createMenuContainer: {
      width: variables.sideBarWidth - 40,
      paddingVertical: variables.componentBorderRadiusLarge,
    },

    createMenuHeaderText: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeLabel,
      color: theme.textSupporting,
    },

    defaultModalContainer: {
      backgroundColor: theme.componentBG,
      borderColor: theme.transparent,
    },

    displayNameTooltipEllipsis: {
      position: 'absolute',
      opacity: 0,
      right: 0,
      bottom: 0,
    },

    dotIndicatorMessage: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },

    draggableTopBar: {
      height: 30,
      width: '100%',
    },

    avatarInnerText: {
      color: theme.text,
      fontSize: variables.fontSizeSmall,
      lineHeight: undefined,
      marginLeft: -3,
      textAlign: 'center',
    },

    avatarInnerTextSmall: {
      color: theme.text,
      fontSize: variables.fontSizeExtraSmall,
      lineHeight: undefined,
      marginLeft: -2,
      textAlign: 'center',
    },

    emptyAvatar: {
      height: variables.avatarSizeNormal,
      width: variables.avatarSizeNormal,
    },

    emptyAvatarSmallNormal: {
      height: variables.avatarSizeSmallNormal,
      width: variables.avatarSizeSmallNormal,
    },

    emptyAvatarSmall: {
      height: variables.avatarSizeSmall,
      width: variables.avatarSizeSmall,
    },

    emptyAvatarSmaller: {
      height: variables.avatarSizeSmaller,
      width: variables.avatarSizeSmaller,
    },

    emptyAvatarMedium: {
      height: variables.avatarSizeMedium,
      width: variables.avatarSizeMedium,
    },

    emptyAvatarLarge: {
      height: variables.avatarSizeLarge,
      width: variables.avatarSizeLarge,
    },

    emptyAvatarMargin: {
      marginRight: variables.avatarChatSpacing,
    },

    emptyAvatarMarginChat: {
      marginRight: variables.avatarChatSpacing - 12,
    },

    emptyAvatarMarginSmall: {
      marginRight: variables.avatarChatSpacing - 4,
    },

    emptyAvatarMarginSmaller: {
      marginRight: variables.avatarChatSpacing - 4,
    },

    flipUpsideDown: {
      // transform: `rotate(180deg)`,
      transform: [{rotate: '180deg'}],
    },

    highlightBG: {
      backgroundColor: theme.highlightBG,
    },

    appBG: {
      backgroundColor: theme.appBG,
    },

    fontSizeLabel: {
      fontSize: variables.fontSizeLabel,
    },

    fontWeightNormal: {
      fontWeight: FontUtils.fontWeight.normal,
    },

    formHelp: {
      color: theme.textSupporting,
      fontSize: variables.fontSizeLabel,
      lineHeight: variables.lineHeightLarge,
      marginBottom: 4,
    },

    formError: {
      color: theme.textError,
      fontSize: variables.fontSizeLabel,
      lineHeight: variables.formErrorLineHeight,
      marginBottom: 4,
    },

    formSuccess: {
      color: theme.success,
      fontSize: variables.fontSizeLabel,
      lineHeight: 18,
      marginBottom: 4,
    },

    fullScreen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },

    fullScreenLoading: {
      backgroundColor: theme.componentBG,
      opacity: 0.8,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },

    headerBar: {
      overflow: 'hidden',
      justifyContent: 'center',
      display: 'flex',
      paddingLeft: 20,
      height: variables.contentHeaderHeight,
      width: '100%',
    },

    headerBarDesktopHeight: {
      height: variables.contentHeaderDesktopHeight,
    },
    headerEnvBadge: {
      position: 'absolute',
      bottom: -8,
      left: -8,
      height: 12,
      width: 22,
      paddingLeft: 4,
      paddingRight: 4,
      alignItems: 'center',
      zIndex: -1,
    },

    headerEnvBadgeText: {
      fontSize: 7,
      fontWeight: FontUtils.fontWeight.bold,
      lineHeight: undefined,
    },

    headerProgressBarContainer: {
      position: 'absolute',
      width: '100%',
      zIndex: -1,
    },

    headerProgressBar: {
      width: variables.componentSizeMedium,
      height: variables.iconSizeXXXSmall,
      borderRadius: variables.componentBorderRadiusRounded,
      backgroundColor: theme.border,
      alignSelf: 'center',
    },

    headerProgressBarFill: {
      borderRadius: variables.componentBorderRadiusRounded,
      height: '100%',
      backgroundColor: theme.success,
    },

    invisiblePopover: {
      position: 'absolute',
      opacity: 0,
      left: -9999,
    },

    makeSlideInTranslation: (translationType: Translation, fromValue: number) =>
      ({
        from: {
          [translationType]: fromValue,
        },
        to: {
          [translationType]: 0,
        },
      }) satisfies CustomAnimation,

    headerText: {
      color: theme.heading,
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      fontSize: variables.fontSizeNormal,
    },

    hiddenElementOutsideOfWindow: {
      position: 'absolute',
      top: -10000,
      left: 0,
      opacity: 0,
    },

    hoveredComponentBG: {
      backgroundColor: theme.hoverComponentBG,
    },

    menuItemError: {
      position: 'absolute',
      bottom: -4,
      left: 20,
      right: 20,
    },

    menuItemTextContainer: {
      minHeight: variables.componentSizeNormal,
    },

    nativeOverlayStyles: (current: OverlayStylesParams) =>
      ({
        position: 'absolute',
        backgroundColor: theme.overlay,
        width: '100%',
        height: '100%',
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, variables.overlayOpacity],
          extrapolate: 'clamp',
        }),
      }) satisfies ViewStyle,

    noBorderRadius: {
      borderRadius: 0,
    },

    noRightBorderRadius: {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },

    noLeftBorderRadius: {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },

    noSelect: {
      boxShadow: 'none',
      outlineStyle: 'none',
    },

    headerGap: {
      // height: CONST.DESKTOP_HEADER_PADDING,
      height: 0,
    },

    iPhoneXSafeArea: {
      backgroundColor: theme.inverse,
      flex: 1,
    },

    link: link(theme),

    navigationScreenCardStyle: {
      backgroundColor: theme.appBG,
      height: '100%',
    },

    componentHeightLarge: {
      height: variables.inputHeight,
    },

    offlineFeedback: {
      deleted: {
        textDecorationLine: 'line-through',
        textDecorationStyle: 'solid',
      },
      pending: {
        opacity: 0.5,
      },
      default: {
        // fixes a crash on iOS when we attempt to remove already unmounted children
        // see https://github.com/Expensify/App/issues/48197 for more details
        // it's a temporary solution while we are working on a permanent fix
        opacity: Platform.OS === 'ios' ? 0.99 : undefined,
      },
      error: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      container: {
        ...spacing.pv2,
      },
      textContainer: {
        flexDirection: 'column',
        flex: 1,
      },
      text: {
        color: theme.textSupporting,
        verticalAlign: 'middle',
        fontSize: variables.fontSizeLabel,
      },
      errorDot: {
        marginRight: 12,
      },
    },

    opacity0: {
      opacity: 0,
    },

    opacitySemiTransparent: {
      opacity: 0.5,
    },

    opacity1: {
      opacity: 1,
    },

    overlayStyles: (current: OverlayStylesParams, isModalOnTheLeft: boolean) =>
      ({
        ...positioning.pFixed,
        // We need to stretch the overlay to cover the sidebar and the translate animation distance.
        left: isModalOnTheLeft ? 0 : -2 * variables.sideBarWidth,
        top: 0,
        bottom: 0,
        right: isModalOnTheLeft ? -2 * variables.sideBarWidth : 0,
        backgroundColor: theme.overlay,
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, variables.overlayOpacity],
          extrapolate: 'clamp',
        }),
      }) satisfies ViewStyle,

    pageWrapper: {
      width: '100%',
      alignItems: 'center',
      padding: 20,
    },

    peopleRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...spacing.ph5,
    },

    peopleRowBorderBottom: {
      borderColor: theme.border,
      borderBottomWidth: 1,
      ...spacing.pb2,
    },

    pointerEventsNone,

    pointerEventsAuto,

    pointerEventsBoxNone,

    popoverMenuItem: {
      flexDirection: 'row',
      borderRadius: 0,
      paddingHorizontal: 20,
      paddingVertical: 12,
      justifyContent: 'space-between',
      width: '100%',
    },

    popoverMenuIcon: {
      width: variables.componentSizeNormal,
      justifyContent: 'center',
      alignItems: 'center',
    },

    popoverMenuText: {
      fontSize: variables.fontSizeNormal,
      color: theme.heading,
    },

    rightLabelMenuItem: {
      fontSize: variables.fontSizeLabel,
      color: theme.textSupporting,
    },

    rootNavigatorContainerStyles: (isSmallScreenWidth: boolean) =>
      ({
        marginLeft: isSmallScreenWidth ? 0 : variables.sideBarWidth,
        flex: 1,
      }) satisfies ViewStyle,

    RHPNavigatorContainerNavigatorContainerStyles: (
      isSmallScreenWidth: boolean,
    ) =>
      ({
        marginLeft: isSmallScreenWidth ? 0 : variables.sideBarWidth,
        flex: 1,
      }) satisfies ViewStyle,

    onboardingNavigatorOuterView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    OnboardingNavigatorInnerView: (shouldUseNarrowLayout: boolean) =>
      ({
        width: shouldUseNarrowLayout ? variables.onboardingModalWidth : '100%',
        height: shouldUseNarrowLayout ? 732 : '100%',
        maxHeight: '100%',
        borderRadius: shouldUseNarrowLayout ? 16 : 0,
        overflow: 'hidden',
      }) satisfies ViewStyle,

    sectionMenuItemTopDescription: {
      ...spacing.ph8,
      ...spacing.mhn8,
      width: 'auto',
    },

    sectionTitle: {
      ...spacing.pt2,
      ...spacing.pr3,
      ...spacing.pb4,
      paddingLeft: 13,
      fontSize: 13,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      lineHeight: 16,
      color: theme.textSupporting,
    },

    sectionMenuItem: {
      borderRadius: 8,
      paddingHorizontal: 8,
      height: 56,
      alignItems: 'center',
    },

    singleAvatar: {
      height: 24,
      width: 24,
      backgroundColor: theme.icon,
      borderRadius: 12,
    },

    singleAvatarSmall: {
      height: 16,
      width: 16,
      backgroundColor: theme.icon,
      borderRadius: 8,
    },

    singleAvatarMedium: {
      height: 52,
      width: 52,
      backgroundColor: theme.icon,
      borderRadius: 52,
    },

    searchTableHeaderActive: {
      fontWeight: FontUtils.fontWeight.bold,
    },

    secondAvatar: {
      position: 'absolute',
      right: -18,
      bottom: -18,
      borderWidth: 2,
      borderRadius: 14,
      borderColor: 'transparent',
    },

    secondAvatarSmall: {
      position: 'absolute',
      right: -14,
      bottom: -14,
      borderWidth: 2,
      borderRadius: 10,
      borderColor: 'transparent',
    },

    secondAvatarMedium: {
      position: 'absolute',
      right: -36,
      bottom: -36,
      borderWidth: 3,
      borderRadius: 52,
      borderColor: 'transparent',
    },

    secondAvatarSubscript: {
      position: 'absolute',
      right: -6,
      bottom: -6,
    },

    secondAvatarSubscriptCompact: {
      position: 'absolute',
      bottom: -4,
      right: -4,
    },

    secondAvatarSubscriptSmallNormal: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },

    secondAvatarInline: {
      bottom: -3,
      right: -25,
      borderWidth: 3,
      borderRadius: 18,
      borderColor: theme.cardBorder,
      backgroundColor: theme.appBG,
    },

    selectCircle: {
      width: variables.componentSizeSmall,
      height: variables.componentSizeSmall,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: variables.componentSizeSmall / 2,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.componentBG,
      marginLeft: 8,
    },

    selectionListPressableItemWrapper: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginHorizontal: 20,
      backgroundColor: theme.highlightBG,
      borderRadius: 8,
    },

    selectionListStickyHeader: {
      backgroundColor: theme.appBG,
    },

    optionAlternateText: {
      minHeight: variables.alternateTextHeight,
      lineHeight: variables.lineHeightXLarge,
    },

    optionsListSectionHeader: {
      marginTop: 8,
      marginBottom: 4,
    },

    optionSelectCircle: {
      borderRadius: variables.componentSizeSmall / 2 + 1,
      padding: 1,
    },

    optionRow: {
      minHeight: variables.optionRowHeight,
      paddingTop: 12,
      paddingBottom: 12,
    },

    optionRowSelected: {
      backgroundColor: theme.activeComponentBG,
    },

    optionRowDisabled: {
      color: theme.textSupporting,
    },

    optionRowCompact: {
      height: variables.optionRowHeightCompact,
      paddingTop: 12,
      paddingBottom: 12,
    },

    optionDisplayName: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      minHeight: variables.alternateTextHeight,
      lineHeight: variables.lineHeightXLarge,
      ...whiteSpace.noWrap,
    },

    optionDisplayNameCompact: {
      minWidth: 'auto',
      flexBasis: 'auto',
      flexGrow: 0,
      flexShrink: 1,
    },

    shortTermsBorder: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: variables.componentBorderRadius,
    },

    shortTermsHorizontalRule: {
      borderBottomWidth: 1,
      borderColor: theme.border,
      ...spacing.mh3,
    },

    shortTermsLargeHorizontalRule: {
      borderWidth: 1,
      borderColor: theme.border,
      ...spacing.mh3,
    },

    shortTermsRow: {
      flexDirection: 'row',
      padding: 12,
    },

    sidebarLink: {
      textDecorationLine: 'none',
    },

    sidebarLinkLHN: {
      textDecorationLine: 'none',
      marginLeft: 12,
      marginRight: 12,
      borderRadius: 8,
    },

    sidebarLinkInner: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingLeft: 20,
      paddingRight: 20,
    },

    sidebarLinkInnerLHN: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingLeft: 8,
      paddingRight: 8,
      marginHorizontal: 12,
      borderRadius: variables.componentBorderRadiusNormal,
    },

    sidebarLinkText: {
      color: theme.textSupporting,
      fontSize: variables.fontSizeNormal,
      textDecorationLine: 'none',
      overflow: 'hidden',
    },

    sidebarLinkHover: {
      backgroundColor: theme.sidebarHover,
    },

    sidebarLinkHoverLHN: {
      backgroundColor: theme.highlightBG,
    },

    sidebarLinkActive: {
      backgroundColor: theme.buttonHoveredBG,
      textDecorationLine: 'none',
    },

    sidebarLinkActiveLHN: {
      backgroundColor: theme.highlightBG,
      textDecorationLine: 'none',
    },

    sidebarLinkTextBold: {
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      color: theme.heading,
    },

    sidebarLinkActiveText: {
      color: theme.textSupporting,
      fontSize: variables.fontSizeNormal,
      textDecorationLine: 'none',
      overflow: 'hidden',
    },

    splashScreenHider: {
      backgroundColor: theme.splashBG,
      alignItems: 'center',
      justifyContent: 'center',
    },

    subscriptIcon: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 20,
      height: 20,
      backgroundColor: theme.buttonDefaultBG,
    },

    textLabel: {
      color: theme.text,
      fontSize: variables.fontSizeLabel,
      lineHeight: variables.lineHeightLarge,
    },

    textLabelError: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeLabel,
      color: theme.textError,
    },

    switchTrack: {
      width: 50,
      height: 28,
      justifyContent: 'center',
      borderRadius: 20,
      padding: 15,
      backgroundColor: theme.success,
    },

    switchInactive: {
      backgroundColor: theme.icon,
    },

    switchThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      position: 'absolute',
      left: 4,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.appBG,
    },

    switchThumbTransformation: (translateX: AnimatableNumericValue) =>
      ({
        transform: [{translateX}],
      }) satisfies ViewStyle,

    furtherDetailsText: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeSmall,
      color: theme.textSupporting,
    },

    toggleSwitchLockIcon: {
      width: variables.iconSizeExtraSmall,
      height: variables.iconSizeExtraSmall,
    },

    lh14: {
      lineHeight: variables.lineHeightSmall,
    },

    lh16: {
      lineHeight: 16,
    },

    lh20: {
      lineHeight: 20,
    },

    mutedTextLabel: {
      color: theme.textSupporting,
      fontSize: variables.fontSizeLabel,
      lineHeight: variables.lineHeightLarge,
    },

    textMicro: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeSmall,
      lineHeight: variables.lineHeightSmall,
    },

    textMicroBold: {
      color: theme.text,
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      fontSize: variables.fontSizeSmall,
      lineHeight: variables.lineHeightSmall,
    },

    textMicroSupporting: {
      color: theme.textSupporting,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeSmall,
      lineHeight: variables.lineHeightSmall,
    },

    textExtraSmallSupporting: {
      color: theme.textSupporting,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeExtraSmall,
    },

    textPlainColor: {
      color: theme.text,
    },

    textNormal: {
      fontSize: variables.fontSizeNormal,
    },

    textNormalThemeText: {
      color: theme.text,
      fontSize: variables.fontSizeNormal,
    },

    textLarge: {
      fontSize: variables.fontSizeLarge,
    },

    textXLarge: {
      fontSize: variables.fontSizeXLarge,
    },

    textXXLarge: {
      fontSize: variables.fontSizeXXLarge,
    },

    textXXXLarge: {
      fontSize: variables.fontSizeXXXLarge,
    },

    textHero: {
      fontSize: variables.fontSizeHero,
      ...FontUtils.fontFamily.platform.EXP_NEW_KANSAS_MEDIUM,
      lineHeight: variables.lineHeightHero,
    },

    textStrong: {
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
    },

    textDanger: {
      color: theme.danger,
    },

    textSupporting: {
      color: theme.textSupporting,
    },

    baseTextInput: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeNormal,
      lineHeight: variables.lineHeightXLarge,
      color: theme.text,
      paddingTop: 23,
      paddingBottom: 8,
      paddingLeft: 0,
      borderWidth: 0,
    },

    textInputDesktop: addOutlineWidth(theme, {}, 0),

    textInputIconContainer: {
      paddingHorizontal: 11,
      justifyContent: 'center',
      margin: 1,
    },

    textInputLeftIconContainer: {
      justifyContent: 'center',
      paddingRight: 8,
    },

    secureInput: {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },

    textInput: {
      backgroundColor: 'transparent',
      borderRadius: variables.componentBorderRadiusNormal,
      height: variables.inputComponentSizeNormal,
      borderColor: theme.border,
      borderWidth: 1,
      color: theme.text,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeNormal,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
      verticalAlign: 'middle',
    },

    textInputPrefixWrapper: {
      position: 'absolute',
      left: 0,
      top: 0,
      height: variables.inputHeight,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 23,
      paddingBottom: 8,
    },

    textInputSuffixWrapper: {
      position: 'absolute',
      right: 0,
      top: 0,
      height: variables.inputHeight,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 23,
      paddingBottom: 8,
    },

    textInputPrefix: {
      color: theme.text,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeNormal,
      verticalAlign: 'middle',
    },

    textInputSuffix: {
      color: theme.text,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeNormal,
      verticalAlign: 'middle',
    },

    // Be extremely careful when editing the compose styles, as it is easy to introduce regressions.
    textInputCompose: addOutlineWidth(
      theme,
      {
        backgroundColor: theme.componentBG,
        borderColor: theme.border,
        color: theme.text,
        ...FontUtils.fontFamily.platform.SYSTEM,
        fontSize: variables.fontSizeNormal,
        borderWidth: 0,
        height: 'auto',
        lineHeight: variables.lineHeightXLarge,
        ...overflow,

        // On Android, multiline TextInput with height: 'auto' will show extra padding unless they are configured with
        // paddingVertical: 0, alignSelf: 'center', and verticalAlign: 'middle'

        paddingHorizontal: variables.avatarChatSpacing,
        paddingTop: 0,
        paddingBottom: 0,
        alignSelf: 'center',
        verticalAlign: 'middle',
      },
      0,
    ),

    textInputContainer: {
      flex: 1,
      justifyContent: 'center',
      height: '100%',
      backgroundColor: 'transparent',
      borderBottomWidth: 2,
      borderColor: theme.border,
      overflow: 'hidden',
    },

    textInputFullCompose: {
      alignSelf: 'stretch',
      flex: 1,
      maxHeight: '100%',
      verticalAlign: 'top',
    },

    textInputCollapseCompose: {
      maxHeight: '100%',
      flex: 4,
    },

    // composer padding should not be modified unless thoroughly tested against the cases in this PR: #12669
    textInputComposeSpacing: {
      paddingVertical: 5,
      ...flex.flexRow,
      flex: 1,
    },

    textInputComposeBorder: {
      borderLeftWidth: 1,
      borderColor: theme.border,
    },

    textInputMultiline: {
      scrollPadding: '23px 0 0 0',
    },

    textInputMultilineContainer: {
      paddingTop: 23,
    },

    textInputAndIconContainer: {
      flex: 1,
      height: '100%',
      zIndex: -1,
      flexDirection: 'row',
    },

    textInputLabel: {
      position: 'absolute',
      left: 0,
      top: 0,
      fontSize: variables.fontSizeNormal,
      color: theme.textSupporting,
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      width: '100%',
      zIndex: 1,
    },

    textInputLabelBackground: {
      position: 'absolute',
      top: 0,
      width: '100%',
      height: 23,
      backgroundColor: theme.componentBG,
    },

    textInputLabelDesktop: {
      transformOrigin: 'left center',
    },

    textInputLabelTransformation: (
      translateY: AnimatableNumericValue,
      translateX: AnimatableNumericValue,
      scale: AnimatableNumericValue,
    ) =>
      ({
        transform: [{translateY}, {translateX}, {scale}],
      }) satisfies TextStyle,

    textAlignCenter: {
      textAlign: 'center',
    },

    textInputDisabled: {
      // Adding disabled color theme to indicate user that the field is not editable.
      backgroundColor: theme.highlightBG,
      borderBottomWidth: 2,
      borderColor: theme.borderLighter,
      // Adding browser specefic style to bring consistency between Safari and other platforms.
      // Applying the Webkit styles only to browsers as it is not available in native.
      ...(Browser.getBrowser()
        ? {
            WebkitTextFillColor: theme.textSupporting,
            WebkitOpacity: 1,
          }
        : {}),
      color: theme.textSupporting,
    },

    textAlignRight: {
      textAlign: 'right',
    },

    textAlignLeft: {
      textAlign: 'left',
    },

    textHeadline: {
      ...headlineFont,
      ...whiteSpace.preWrap,
      color: theme.heading,
      fontSize: variables.fontSizeXLarge,
      lineHeight: variables.lineHeightXXXLarge,
    },

    textHeadlineH2: {
      ...headlineFont,
      ...whiteSpace.preWrap,
      color: theme.heading,
      fontSize: variables.fontSizeh2,
      lineHeight: variables.lineHeightSizeh2,
    },

    textHeadlineH1: {
      ...headlineFont,
      ...whiteSpace.preWrap,
      color: theme.heading,
      fontSize: variables.fontSizeXLarge,
      lineHeight: variables.lineHeightSizeh1,
    },

    textLabelSupporting: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeLabel,
      color: theme.textSupporting,
    },

    textLabelSupportingEmptyValue: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeNormal,
      color: theme.textSupporting,
    },

    textLabelSupportingNormal: {
      ...FontUtils.fontFamily.platform.EXP_NEUE,
      fontSize: variables.fontSizeLabel,
      color: theme.textSupporting,
    },

    textLoading: {
      ...FontUtils.fontFamily.platform.EXP_NEUE_BOLD,
      fontSize: variables.fontSizeXLarge,
      color: theme.text,
    },

    textWhite: {
      color: theme.textLight,
    },

    textBlue: {
      color: theme.link,
    },

    timePickerInput: {
      fontSize: 69,
      minWidth: 56,
      alignSelf: 'center',
    },
    timePickerWidth100: {
      width: 100,
    },
    timePickerHeight100: {
      height: 100,
    },
    timePickerSemiDot: {
      fontSize: 69,
      height: 84,
      alignSelf: 'center',
    },
    timePickerSwitcherContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    touchableButtonImage: {
      alignItems: 'center',
      height: variables.componentSizeNormal,
      justifyContent: 'center',
      width: variables.componentSizeNormal,
    },

    verticalAlignTop: {
      verticalAlign: 'top',
    },

    visuallyHidden: {
      ...visibility.hidden,
      overflow: 'hidden',
      width: 0,
      height: 0,
    },

    visibilityHidden: {
      ...visibility.hidden,
    },

    webViewStyles: webViewStyles(theme),

    label: {
      fontSize: variables.fontSizeLabel,
      lineHeight: variables.lineHeightLarge,
    },
  }) satisfies Styles;

type ThemeStyles = ReturnType<typeof styles>;

const defaultStyles = styles(defaultTheme);

export default styles;
export {defaultStyles};
export type {
  Styles,
  ThemeStyles,
  StatusBarStyle,
  ColorScheme,
  AnchorPosition,
  AnchorDimensions,
};
