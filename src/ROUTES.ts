import type {DrinkingSessionId} from './types/onyx';
import type {UserID, DateString} from './types/onyx/OnyxCommon';

/**
 * Builds a URL with an encoded URI component for the `backTo` param which can be added to the end of URLs
 */
function getUrlWithBackToParam<TUrl extends string>(
  url: TUrl,
  backTo?: string,
): `${TUrl}` | `${TUrl}?backTo=${string}` | `${TUrl}&backTo=${string}` {
  const backToParam = backTo
    ? (`${url.includes('?') ? '&' : '?'}backTo=${encodeURIComponent(backTo)}` as const)
    : '';
  return `${url}${backToParam}` as const;
}

const PUBLIC_SCREENS_ROUTES = {
  ROOT: '',
  FORCE_UPDATE: 'force-update',
  INITIAL: 'initial',
  AUTH: 'auth',
  FORGOT_PASSWORD: 'forgot-password',
  DESKTOP_SIGN_IN_REDIRECT: 'desktop-signin-redirect',
  APPLE_SIGN_IN: 'sign-in-with-apple',
  GOOGLE_SIGN_IN: 'sign-in-with-google',
  TRANSITION_BETWEEN_APPS: 'transition',
} as const;

const ROUTES = {
  ...PUBLIC_SCREENS_ROUTES,

  HOME: 'home',
  PICK_USERNAME: 'pick-username',

  ACHIEVEMENTS: 'achievements',

  DAY_OVERVIEW: {
    route: 'day-overview/:date',
    getRoute: (date: DateString) => `day-overview/${date}` as const,
  },

  DRINKING_SESSION: {
    route: 'drinking-session/:sessionId',
    getRoute: (sessionId: DrinkingSessionId) =>
      `drinking-session/${sessionId}` as const,
  },
  DRINKING_SESSION_LIVE: {
    route: 'drinking-session/:sessionId/live',
    getRoute: (sessionId: DrinkingSessionId, backTo = '') =>
      getUrlWithBackToParam(
        `drinking-session/${sessionId}/live` as const,
        backTo,
      ),
  },
  DRINKING_SESSION_EDIT: {
    route: 'drinking-session/:sessionId/edit',
    getRoute: (sessionId: DrinkingSessionId, backTo = '') =>
      getUrlWithBackToParam(
        `drinking-session/${sessionId}/edit` as const,
        backTo,
      ),
  },
  DRINKING_SESSION_SESSION_DATE_SCREEN: {
    route: 'drinking-session/:sessionId/session-date-screen',
    getRoute: (sessionId: DrinkingSessionId, backTo = '') =>
      getUrlWithBackToParam(
        `drinking-session/${sessionId}/session-date-screen` as const,
        backTo,
      ),
  },
  DRINKING_SESSION_SESSION_NOTE_SCREEN: {
    route: 'drinking-session/:sessionId/session-note-screen',
    getRoute: (sessionId: DrinkingSessionId) =>
      `drinking-session/${sessionId}/session-note-screen` as const,
  },
  DRINKING_SESSION_SESSION_TIMEZONE_SCREEN: {
    route: 'drinking-session/:sessionId/session-timezone-screen',
    getRoute: (sessionId: DrinkingSessionId) =>
      `drinking-session/${sessionId}/session-timezone-screen` as const,
  },
  DRINKING_SESSION_SUMMARY: {
    route: 'drinking-session/:sessionId/summary',
    getRoute: (sessionId: DrinkingSessionId) =>
      `drinking-session/${sessionId}/summary` as const,
  },

  TZ_FIX_ROOT: 'tz-fix',
  TZ_FIX_INTRODUCTION: 'tz-fix/introduction',
  TZ_FIX_DETECTION: 'tz-fix/detection',
  TZ_FIX_CONFIRMATION: 'tz-fix/confirmation',
  TZ_FIX_SELECTION: 'tz-fix/selection',
  TZ_FIX_SUCCESS: 'tz-fix/success',

  SETTINGS: 'settings',

  SETTINGS_ABOUT: 'settings/about',
  SETTINGS_ACCOUNT: 'settings/account',
  SETTINGS_USER_NAME: 'settings/user-name',
  SETTINGS_DISPLAY_NAME: 'settings/display-name',
  SETTINGS_EMAIL: 'settings/email',
  SETTINGS_PASSWORD: 'settings/password',
  SETTINGS_TIMEZONE: 'settings/timezone',
  SETTINGS_TIMEZONE_SELECT: 'settings/timezone-select',
  // SETTINGS_TIMEZONE_SELECT: {
  //   route: 'settings/timezone-select',
  //   getRoute: (selected: SelectedTimezone, backTo?: string) =>
  //     getUrlWithBackToParam(
  //       `settings/timezone-select?timezone=${selected}`,
  //       backTo,
  //     ),
  // },

  SETTINGS_APP_SHARE: 'settings/app-share',
  SETTINGS_PREFERENCES: 'settings/preferences',
  SETTINGS_LANGUAGE: 'settings/preferences/language',
  SETTINGS_THEME: 'settings/preferences/theme',
  SETTINGS_FIRST_DAY_OF_WEEK: 'settings/preferences/first-day-of-week',
  SETTINGS_UNITS_TO_COLORS: 'settings/preferences/units-to-colors',
  SETTINGS_DRINKS_TO_UNITS: 'settings/preferences/drinks-to-units',

  SETTINGS_TERMS_OF_SERVICE: 'settings/terms-of-service',
  SETTINGS_PRIVACY_POLICY: 'settings/privacy-policy',
  SETTINGS_REPORT_BUG: 'settings/report-bug',
  SETTINGS_FEEDBACK: 'settings/feedback',
  SETTINGS_DELETE: 'settings/delete',
  SETTINGS_ADMIN: 'settings/admin',
  SETTINGS_ADMIN_FEEDBACK: 'settings/admin/feedback',
  SETTINGS_ADMIN_BUGS: 'settings/admin/bugs',

  PROFILE: {
    route: 'profile/:userID',
    getRoute: (userID: UserID) => `profile/${userID}` as const,
  },
  PROFILE_FRIENDS_FRIENDS: {
    route: 'profile/:userID/friends',
    getRoute: (userID: UserID) => `profile/${userID}/friends` as const,
  },

  SOCIAL: 'social',

  // Causes an error
  // SOCIAL: {
  //   route: 'social/:screen',
  //   getRoute: (screen: DeepValueOf<typeof SCREENS.SOCIAL>) =>
  //     `social/${screen}` as const,
  // },
  SOCIAL_FRIEND_LIST: 'social/friend-list',
  SOCIAL_FRIEND_REQUESTS: 'social/friend-requests',
  SOCIAL_FRIEND_SEARCH: 'social/friend-search',

  STATISTICS: 'statistics',
} as const;

export {getUrlWithBackToParam, PUBLIC_SCREENS_ROUTES};
export default ROUTES;

type ExtractRouteName<TRoute> = TRoute extends {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRoute: (...args: any[]) => infer TRouteName;
}
  ? TRouteName
  : TRoute;

/**
 * Represents all routes in the app as a union of literal strings.
 */
type Route = {
  [K in keyof typeof ROUTES]: ExtractRouteName<(typeof ROUTES)[K]>;
}[keyof typeof ROUTES];

export type {Route};
