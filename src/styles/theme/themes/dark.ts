import colors from '@styles/theme/colors';
import type {ThemeColors} from '@styles/theme/types';
import CONST from '@src/CONST';
import SCREENS from '@src/SCREENS';

const darkTheme = {
  // Figma keys
  appBG: colors.productDark100,
  splashBG: colors.yellowStrong,
  highlightBG: colors.productDark200,
  darkBG: colors.productLight900,
  appColor: colors.yellowStrong,
  border: colors.productDark400,
  borderLighter: colors.productDark400,
  borderFocus: colors.yellow,
  icon: colors.productDark700,
  iconDark: colors.productDark900,
  iconMenu: colors.yellowStrong,
  iconHovered: colors.productDark900,
  iconMenuHovered: colors.yellow,
  iconSuccessFill: colors.yellowStrong,
  iconReversed: colors.productDark100,
  textSupporting: colors.productDark800,
  text: colors.productDark900,
  syntax: colors.productDark800,
  link: colors.blue300,
  linkHover: colors.blue100,
  buttonDefaultBG: colors.productDark400,
  buttonHoveredBG: colors.productDark500,
  buttonPressedBG: colors.productDark600,
  danger: colors.red,
  dangerHover: colors.redHover,
  dangerPressed: colors.redHover,
  warning: colors.yellow400,
  success: colors.yellowStrong,
  successHover: colors.yellowHover,
  successPressed: colors.yellowPressed,
  add: colors.orange200,
  addHover: colors.orange300,
  addPressed: colors.orange800,
  transparent: colors.transparent,
  signInPage: colors.appBG,
  darkSupportingText: colors.productDark800,
  searchBarBG: colors.productDark300,

  // Additional keys
  overlay: colors.productDark400,
  inverse: colors.productDark900,
  shadow: colors.black,
  componentBG: colors.productDark100,
  hoverComponentBG: colors.productDark300,
  activeComponentBG: colors.productDark400,
  signInSidebar: colors.appBG,
  sidebar: colors.productDark100,
  sidebarHover: colors.productDark300,
  heading: colors.productDark900,
  textLight: colors.productDark900,
  textDark: colors.productDark100,
  textReversed: colors.productLight900,
  textBackground: colors.productDark200,
  textMutedReversed: colors.productDark700,
  textError: colors.red,
  offline: colors.productDark700,
  modalBackground: colors.productDark100,
  safeAreaBackground: colors.productDark100,
  cardBG: colors.productDark200,
  cardBorder: colors.productDark200,
  spinner: colors.productDark800,
  unreadIndicator: colors.green400,
  placeholderText: colors.productDark700,
  heroCard: colors.blue400,
  uploadPreviewActivityIndicator: colors.productDark200,
  checkBox: colors.orange300,
  imageCropBackgroundColor: colors.productDark700,
  fallbackIconColor: colors.green700,
  badgeAdHoc: colors.pink600,
  badgeAdHocHover: colors.pink700,
  tooltipHighlightBG: colors.orange100, // TODO check
  tooltipHighlightText: colors.orange500, // TODO check
  tooltipSupportingText: colors.productDark800,
  tooltipPrimaryText: colors.productDark900,
  skeletonLHNIn: colors.productDark400,
  skeletonLHNOut: colors.productDark600,
  QRLogo: colors.yellow,
  appLogo: colors.productDark900,
  white: colors.white,
  transparentWhite: `${colors.white}51`,

  // Adding a color here will animate the status bar to the right color when the screen is opened.
  // Note that it needs to be a screen name, not a route url.
  // The route urls from ROUTES.ts are only used for deep linking and configuring URLs on web.
  // The screen name (see SCREENS.ts) is the name of the screen as far as react-navigation is concerned, and the linkingConfig maps screen names to URLs
  PAGE_THEMES: {
    [SCREENS.HOME]: {
      backgroundColor: colors.productDark100,
      statusBarStyle: CONST.STATUS_BAR_STYLE.LIGHT_CONTENT,
    },
    [SCREENS.SETTINGS.PREFERENCES.ROOT]: {
      backgroundColor: colors.productDark100,
      statusBarStyle: CONST.STATUS_BAR_STYLE.LIGHT_CONTENT,
    },
    [SCREENS.SETTINGS.ROOT]: {
      backgroundColor: colors.productDark100,
      statusBarStyle: CONST.STATUS_BAR_STYLE.LIGHT_CONTENT,
    },
  },

  statusBarStyle: CONST.STATUS_BAR_STYLE.LIGHT_CONTENT,
  colorScheme: CONST.COLOR_SCHEME.DARK,
} satisfies ThemeColors;

export default darkTheme;
