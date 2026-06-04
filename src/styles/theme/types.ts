import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type {ColorScheme, StatusBarStyle} from '..';

type Color = string;

type ThemePreference = ValueOf<typeof CONST.THEME>;
type ThemePreferenceWithoutSystem = Exclude<
  ThemePreference,
  typeof CONST.THEME.SYSTEM
>;

type ThemeColors = {
  // Figma keys
  appBG: Color;
  splashBG: Color;
  highlightBG: Color;
  darkBG: Color;
  appColor: Color;
  border: Color;
  borderLighter: Color;
  borderFocus: Color;
  icon: Color;
  iconDark: Color;
  iconMenu: Color;
  iconHovered: Color;
  iconMenuHovered: Color;
  iconSuccessFill: Color;
  iconReversed: Color;
  textSupporting: Color;
  text: Color;
  syntax: Color;
  link: Color;
  linkHover: Color;
  buttonDefaultBG: Color;
  buttonHoveredBG: Color;
  buttonPressedBG: Color;
  danger: Color;
  dangerHover: Color;
  dangerPressed: Color;
  warning: Color;
  success: Color;
  successHover: Color;
  successPressed: Color;
  add: Color;
  addHover: Color;
  addPressed: Color;
  transparent: Color;
  signInPage: Color;
  darkSupportingText: Color;
  searchBarBG: Color;

  // Additional keys
  overlay: Color;
  inverse: Color;
  shadow: Color;
  componentBG: Color;
  hoverComponentBG: Color;
  activeComponentBG: Color;
  signInSidebar: Color;
  sidebar: Color;
  sidebarHover: Color;
  heading: Color;
  textLight: Color;
  textDark: Color;
  textOnBrand: Color;
  textReversed: Color;
  textBackground: Color;
  textMutedReversed: Color;
  textError: Color;
  offline: Color;
  modalBackground: Color;
  safeAreaBackground: Color;
  cardBG: Color;
  cardBorder: Color;
  spinner: Color;
  unreadIndicator: Color;
  placeholderText: Color;
  heroCard: Color;
  uploadPreviewActivityIndicator: Color;
  checkBox: Color;
  imageCropBackgroundColor: Color;
  fallbackIconColor: Color;
  badgeAdHoc: Color;
  badgeAdHocHover: Color;
  tooltipHighlightBG: Color;
  tooltipHighlightText: Color;
  tooltipSupportingText: Color;
  tooltipPrimaryText: Color;
  skeletonLHNIn: Color;
  skeletonLHNOut: Color;
  skeletonBlockBG: Color;
  QRLogo: Color;
  appLogo: Color;
  white: Color;
  transparentWhite: Color;

  PAGE_THEMES: Record<
    string,
    {backgroundColor: Color; statusBarStyle: StatusBarStyle}
  >;

  // Status bar and scroll bars need to adapt their theme based on the active user theme for good contrast
  // Therefore, we need to define specific themes for these elements
  // e.g. the StatusBar displays either "light-content" or "dark-content" based on the theme
  statusBarStyle: StatusBarStyle;
  colorScheme: ColorScheme;
};

export {
  type ThemePreference,
  type ThemePreferenceWithoutSystem,
  type ThemeColors,
  type Color,
};
