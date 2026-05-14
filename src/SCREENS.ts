/**
 * This is a file containing constants for all of the screen names. In most cases, we should use the routes for
 * navigation. But there are situations where we may need to access screen names directly.
 */
import type DeepValueOf from './types/utils/DeepValueOf';

const PROTECTED_SCREENS = {
  HOME: 'Home',
  PICK_USERNAME: 'PickUsername',
} as const;

const SCREENS = {
  ...PROTECTED_SCREENS,
  NOT_FOUND: 'not-found',
  // Public screens
  INITIAL: 'Initial',
  AUTH: 'Auth',
  FORGOT_PASSWORD: 'ForgotPassword',
  FORCE_UPDATE: 'ForceUpdate',

  TZ_FIX: {
    ROOT: 'TZFix_Root',
    INTRODUCTION: 'TZFix_Introduction',
    DETECTION: 'TZFix_Detection',
    SELECTION: 'TZFix_Selection',
    CONFIRMATION: 'TZFix_Confirmation',
    SUCCESS: 'TZFix_Success',
  },

  RIGHT_MODAL: {
    ACHIEVEMENTS: 'Achievements',
    DAY_OVERVIEW: 'DayOverview',
    DRINKING_SESSION: 'DrinkingSession',
    SETTINGS: 'Settings',
    PROFILE: 'Profile',
    SOCIAL: 'Social',
    STATISTICS: 'Statistics',
  },

  ACHIEVEMENTS: {
    ROOT: 'Achievements_Root',
  },

  DAY_OVERVIEW: {
    ROOT: 'DayOverview_Root',
  },

  DRINKING_SESSION: {
    ROOT: 'DrinkingSession_Root',
    LIVE: 'DrinkingSession_Live',
    EDIT: 'DrinkingSession_Edit',
    SESSION_DATE_SCREEN: 'DrinkingSession_SessionDateScreen',
    SESSION_NOTE_SCREEN: 'DrinkingSession_SessionNoteScreen',
    SESSION_TIMEZONE_SCREEN: 'DrinkingSession_SessionTimezoneScreen',
    SUMMARY: 'DrinkingSession_Summary',
  },

  SETTINGS: {
    ROOT: 'Settings_Root',
    APP_SHARE: 'Settings_AppShare',

    ACCOUNT: {
      ROOT: 'Settings_Account',
      USER_NAME: 'Settings_UserName',
      DISPLAY_NAME: 'Settings_DisplayName',
      EMAIL: 'Settings_Email',
      PASSWORD: 'Settings_Password',
      TIMEZONE: 'Settings_Timezone',
      TIMEZONE_SELECT: 'Settings_Timezone_Select',
      // ...
    },

    PREFERENCES: {
      ROOT: 'Settings_Preferences',
      LANGUAGE: 'Settings_Preferences_Language',
      THEME: 'Settings_Preferences_Theme',
      FIRST_DAY_OF_WEEK: 'Settings_Preferences_FirstDayOfWeek',
      UNITS_TO_COLORS: 'Settings_Preferences_UnitsToColors',
      DRINKS_TO_UNITS: 'Settings_Preferences_DrinksToUnits',
    },

    ADMIN: {
      ROOT: 'Settings_Admin',
      FEEDBACK: 'Settings_Admin_Feedback',
      BUGS: 'Settings_Admin_Bugs',
    },

    ABOUT: 'Settings_About',
    TERMS_OF_SERVICE: 'Settings_TermsOfService',
    PRIVACY_POLICY: 'Settings_PrivacyPolicy',
    REPORT_BUG: 'Settings_ReportBug',
    FEEDBACK: 'Settings_Feedback',
    DELETE: 'Settings_Delete',
  },

  PROFILE: {
    ROOT: 'Profile_Root',
    FRIENDS_FRIENDS: 'Profile_FriendsFriends',
  },

  SOCIAL: {
    ROOT: 'Social_Root',
    FRIEND_LIST: 'Social_FriendList',
    FRIEND_REQUESTS: 'Social_FriendRequests',
    FRIEND_SEARCH: 'Social_FriendSearch',
  },

  STATISTICS: {
    ROOT: 'Statistics_Root',
  },
} as const;

type Screen = DeepValueOf<typeof SCREENS>;

export default SCREENS;
export {PROTECTED_SCREENS};
export type {Screen};
