// Taken and modified form the Expensify GitHub
// Source: https://github.com/Expensify/App/blob/main/src/CONST.ts

// import Config from 'react-native-config';

// Creating a default array and object this way because objects ({}) and arrays ([]) are not stable types.
// Freezing the array ensures that it cannot be unintentionally modified.
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

const ANDROID_PACKAGE_NAME = 'com.alcohol_tracker';

const CONST = {
  ACCOUNT_CREATION_LIMIT: 3,
  ANDROID_PACKAGE_NAME,
  ANIMATED_TRANSITION: 300,
  ANIMATED_TRANSITION_FROM_VALUE: 100,
  ANIMATION_IN_TIMING: 100,
  ANIMATION_DIRECTION: {
    IN: 'in',
    OUT: 'out',
  },
  APP_DOWNLOAD_LINK:
    'https://petrcala.github.io/Kiroku/assets/html/qr-link.html',
  APP_QR_CODE_LINK:
    'https://petrcala.github.io/Kiroku/assets/images/kiroku-qr-code-with-logo.png',
  APP_IN_BETA: true,
  AVAILABLE_PLATFORMS: ['ios', 'android'],
  AVATAR_SIZE: {
    XLARGE: 'xlarge',
    LARGE: 'large',
    MEDIUM: 'medium',
    DEFAULT: 'default',
    SMALL: 'small',
    SMALLER: 'smaller',
    SUBSCRIPT: 'subscript',
    SMALL_SUBSCRIPT: 'small-subscript',
    MID_SUBSCRIPT: 'mid-subscript',
    LARGE_BORDERED: 'large-bordered',
    HEADER: 'header',
    MENTION_ICON: 'mention-icon',
    SMALL_NORMAL: 'small-normal',
  },
  BROWSER: {
    CHROME: 'chrome',
    FIREFOX: 'firefox',
    IE: 'ie',
    EDGE: 'edge',
    Opera: 'opera',
    SAFARI: 'safari',
    OTHER: 'other',
  },
  BUTTON_STATES: {
    DEFAULT: 'default',
    ACTIVE: 'active',
    PRESSED: 'pressed',
    COMPLETE: 'complete',
    DISABLED: 'disabled',
  },
  CACHE: {
    PROFILE_PICTURE_KEY: 'profilePicture',
  },
  COLOR_SCHEME: {
    LIGHT: 'light',
    DARK: 'dark',
  },
  DATE: {
    SQL_DATE_TIME: 'YYYY-MM-DD HH:mm:ss',
    FNS_FORMAT_STRING: 'yyyy-MM-dd',
    LOCAL_TIME_FORMAT: 'h:mm a',
    YEAR_MONTH_FORMAT: 'yyyyMM',
    MONTH_FORMAT: 'MMMM',
    WEEKDAY_TIME_FORMAT: 'eeee',
    MONTH_DAY_ABBR_FORMAT: 'MMM d',
    SHORT_DATE_FORMAT: 'MM-dd',
    MONTH_DAY_YEAR_ABBR_FORMAT: 'MMM d, yyyy',
    MONTH_DAY_YEAR_FORMAT: 'MMMM d, yyyy',
    FNS_TIMEZONE_FORMAT_STRING: "yyyy-MM-dd'T'HH:mm:ssXXX",
    FNS_DB_FORMAT_STRING: 'yyyy-MM-dd HH:mm:ss.SSS',
    LONG_DATE_FORMAT_WITH_WEEKDAY: 'eeee, MMMM d, yyyy',
    UNIX_EPOCH: '1970-01-01 00:00:00.000',
    MAX_DATE: '9999-12-31',
    MIN_DATE: '0001-01-01',
    ORDINAL_DAY_OF_MONTH: 'do',
  },
  DIRECTION: {
    LEFT: 'left',
    RIGHT: 'right',
  },
  DROPDOWN_BUTTON_SIZE: {
    LARGE: 'large',
    MEDIUM: 'medium',
  },
  ENVIRONMENT: {
    DEV: 'development',
    STAGING: 'staging',
    PROD: 'production',
    TEST: 'test',
  },
  EMPTY_ARRAY,
  EMPTY_OBJECT,
  FIREBASE_STORAGE_URL: 'https://firebasestorage.googleapis.com',
  FRIEND_REQUEST_STATUS: {
    SELF: 'self',
    SENT: 'sent',
    RECEIVED: 'received',
    FRIEND: 'friend',
    UNDEFINED: 'undefined',
  },
  INVALID_CHARS: ['.', '#', '$', '[', ']'],
  LOCAL_IMAGE_PREFIX: 'file://',
  MAX_ALLOWED_UNITS: 100,
  MONTHS: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  MONTHS_ABBREVIATED: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  NAVIGATION: {
    TYPE: {
      FORCED_UP: 'FORCED_UP',
      UP: 'UP',
    },
    ACTION_TYPE: {
      REPLACE: 'REPLACE',
      PUSH: 'PUSH',
      NAVIGATE: 'NAVIGATE',
    },
    SESSION_ACTION: {
      SAVE: 'SAVE',
      DISCARD: 'DISCARD',
    },
  },
  NO_IMAGE: 'NO_IMAGE', // Used for the profile avatar when there is no image
  OS: {
    WINDOWS: 'Windows',
    MAC_OS: 'Mac OS',
    ANDROID: 'Android',
    IOS: 'iOS',
    LINUX: 'Linux',
    NATIVE: 'Native',
  },
  REGEX: {
    ROUTES: {
      REDUNDANT_SLASHES: /(\/{2,})|(\/$)/g,
    },
    // DATE_TIME_FORMAT: /^\d{2}-\d{2} \d{2}:\d{2} [AP]M$/,
  },
  SESSION_EXPIRY: 60 * 60 * 1000 * 12, // 12 hours
  SESSION_TYPES: {
    LIVE: 'live',
    EDIT: 'edit',
  },
  SOCIALS: {
    TWITTER: '',
    INSTAGRAM: '',
    FACEBOOK: '',
    LINKEDIN: '',
  },
  STATUS_BAR_STYLE: {
    LIGHT_CONTENT: 'light-content',
    DARK_CONTENT: 'dark-content',
  },
  STORE_LINKS: {
    ANDROID:
      'https://play.google.com/store/apps/details?id=com.alcohol_tracker',
    IOS: 'https://testflight.apple.com/join/DgY9IieL',
  },
  THEME: {
    DEFAULT: 'system',
    FALLBACK: 'dark',
    DARK: 'dark',
    LIGHT: 'light',
    SYSTEM: 'system',
  },
  TIMING: {
    HOMEPAGE_INITIAL_RENDER: 'homepage_initial_render',
    SEARCH_RENDER: 'search_render',
    COLD: 'cold',
    WARM: 'warm',
    COMMENT_LENGTH_DEBOUNCE_TIME: 500,
    SEARCH_OPTION_LIST_DEBOUNCE_TIME: 300,
    RESIZE_DEBOUNCE_TIME: 100,
  },
  TIME_PERIOD: {
    AM: 'AM',
    PM: 'PM',
  },
  DRINKS: {
    // Perhaps move to types?
    KEYS: {
      SMALL_BEER: 'small_beer',
      BEER: 'beer',
      COCKTAIL: 'cocktail',
      OTHER: 'other',
      STRONG_SHOT: 'strong_shot',
      WEAK_SHOT: 'weak_shot',
      WINE: 'wine',
    },
    NAMES: {
      SMALL_BEER: 'Small Beer',
      BEER: 'Beer',
      COCKTAIL: 'Cocktail',
      OTHER: 'Other',
      STRONG_SHOT: 'Strong Shot',
      WEAK_SHOT: 'Weak Shot',
      WINE: 'Wine',
    },
  },
} as const;

export default CONST;
