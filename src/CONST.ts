import dateAdd from 'date-fns/add';
import dateSubtract from 'date-fns/sub';
import * as KeyCommand from 'react-native-key-command';
import SCREENS from './SCREENS';

// Creating a default array and object this way because objects ({}) and arrays ([]) are not stable types.
// Freezing the array ensures that it cannot be unintentionally modified.
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});
const CURRENT_YEAR = new Date().getFullYear();
const PLATFORM_OS_MACOS = 'Mac OS';
const PLATFORM_IOS = 'iOS';
const ANDROID_PACKAGE_NAME = 'com.alcohol_tracker';
const GH_PAGES_URL = 'https://petrcala.github.io/Kiroku';
const MAX_DATE = dateAdd(new Date(), {years: 1});
const MIN_DATE = dateSubtract(new Date(), {years: 20});

const keyModifierControl =
  KeyCommand?.constants?.keyModifierControl ?? 'keyModifierControl';
const keyModifierCommand =
  KeyCommand?.constants?.keyModifierCommand ?? 'keyModifierCommand';
const keyModifierShiftControl =
  KeyCommand?.constants?.keyModifierShiftControl ?? 'keyModifierShiftControl';
const keyModifierShiftCommand =
  KeyCommand?.constants?.keyModifierShiftCommand ?? 'keyModifierShiftCommand';
const keyInputEscape =
  KeyCommand?.constants?.keyInputEscape ?? 'keyInputEscape';
const keyInputEnter = KeyCommand?.constants?.keyInputEnter ?? 'keyInputEnter';
const keyInputUpArrow =
  KeyCommand?.constants?.keyInputUpArrow ?? 'keyInputUpArrow';
const keyInputDownArrow =
  KeyCommand?.constants?.keyInputDownArrow ?? 'keyInputDownArrow';
const keyInputLeftArrow =
  KeyCommand?.constants?.keyInputLeftArrow ?? 'keyInputLeftArrow';
const keyInputRightArrow =
  KeyCommand?.constants?.keyInputRightArrow ?? 'keyInputRightArrow';

// describes if a shortcut key can cause navigation
const KEYBOARD_SHORTCUT_NAVIGATION_TYPE = 'NAVIGATION_SHORTCUT';

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
  APP_DOWNLOAD_LINK: `${GH_PAGES_URL}/assets/html/qr-link.html`,
  APP_QR_CODE_LINK: `${GH_PAGES_URL}/assets/images/kiroku-qr-code-with-logo.png`,
  APP_URLS: {
    DEV: 'https://dev.kiroku.com',
    STAGING: 'https://staging.kiroku.com',
    PROD: 'https://kiroku.com',
    ADHOC: 'https://adhoc.kiroku.com',
    TEST: 'https://test.kiroku.com',
  },
  KIROKU_URL: 'https://kiroku.com',
  PRIVACY_POLICY_URL: `${GH_PAGES_URL}/assets/html/privacy-policy.html`,
  TERMS_OF_SERVICE_URL: `${GH_PAGES_URL}/assets/html/terms-of-service.html`,
  API_REQUEST_TYPE: {
    READ: 'read',
    WRITE: 'write',
    MAKE_REQUEST_WITH_SIDE_EFFECTS: 'makeRequestWithSideEffects',
  },
  AUTO_AUTH_STATE: {
    NOT_STARTED: 'not-started',
    SIGNING_IN: 'signing-in',
    JUST_SIGNED_IN: 'just-signed-in',
    FAILED: 'failed',
  },
  APP_STATE: {
    ACTIVE: 'active',
    BACKGROUND: 'background',
    INACTIVE: 'inactive',
  },
  APP_IN_BETA: true,
  AUTH_TOKEN_TYPES: {
    ANONYMOUS: 'anonymousAccount',
    SUPPORT: 'support',
  },
  AVAILABLE_PLATFORMS: ['ios', 'android'],
  ACTIVITY_INDICATOR_SIZE: {
    SMALL: 'small',
    LARGE: 'large',
  },
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
  AVATAR_ROW_SIZE: {
    DEFAULT: 4,
    LARGE_SCREEN: 8,
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

  CALENDAR_PICKER: {
    // Numbers were arbitrarily picked.
    MIN_YEAR: CURRENT_YEAR - 100,
    MAX_YEAR: CURRENT_YEAR + 100,
    MAX_DATE,
    MIN_DATE,
  },
  COLOR_SCHEME: {
    LIGHT: 'light',
    DARK: 'dark',
  },
  CONFIRM_CONTENT_SVG_SIZE: {
    HEIGHT: 220,
    WIDTH: 130,
  },
  COUNTRY: {
    US: 'US',
    CZ: 'CZ',
  },
  CUSTOM_STATUS_TYPES: {
    NEVER: 'never',
    THIRTY_MINUTES: 'thirtyMinutes',
    ONE_HOUR: 'oneHour',
    AFTER_TODAY: 'afterToday',
    AFTER_WEEK: 'afterWeek',
    CUSTOM: 'custom',
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

  DATE_BIRTH: {
    MIN_AGE: 18,
    MAX_AGE: 150,
  },

  DEBUG_CONSOLE: {
    LEVELS: {
      INFO: 'INFO',
      ERROR: 'ERROR',
      RESULT: 'RESULT',
      DEBUG: 'DEBUG',
    },
  },
  DEEPLINK_BASE_URL: 'kiroku://',
  DEFAULT_AVATAR_COUNT: 24,
  DIRECTION: {
    LEFT: 'left',
    RIGHT: 'right',
  },
  DISPLAY_NAME: {
    RESERVED_NAMES: ['Kiroku'],
  },
  DROPDOWN_BUTTON_SIZE: {
    LARGE: 'large',
    MEDIUM: 'medium',
  },
  ENVIRONMENT: {
    DEV: 'development',
    ADHOC: 'adhoc',
    PROD: 'production',
    STAGING: 'staging',
    TEST: 'test',
  },
  LHN_SKELETON_VIEW_ITEM_HEIGHT: 64,
  SEARCH_SKELETON_VIEW_ITEM_HEIGHT: 108,
  EMAIL: {
    KIROKU: 'kiroku.alcohol.tracker@gmail.com',
  },
  EMPTY_ARRAY,
  EMPTY_OBJECT,
  ERROR: {
    XHR_FAILED: 'xhrFailed',
    THROTTLED: 'throttled',
    UNKNOWN_ERROR: 'Unknown error',
    REQUEST_CANCELLED: 'AbortError',
    FAILED_TO_FETCH: 'Failed to fetch',
    ENSURE_BUGBOT: 'ENSURE_BUGBOT',
    PUSHER_ERROR: 'PusherError',
    WEB_SOCKET_ERROR: 'WebSocketError',
    NETWORK_REQUEST_FAILED: 'Network request failed',
    SAFARI_DOCUMENT_LOAD_ABORTED: 'cancelled',
    FIREFOX_DOCUMENT_LOAD_ABORTED:
      'NetworkError when attempting to fetch resource.',
    IOS_NETWORK_CONNECTION_LOST: 'The network connection was lost.',
    IOS_NETWORK_CONNECTION_LOST_CZECH: 'Spojení bylo ztraceno.',
    IOS_LOAD_FAILED: 'Load failed',
    SAFARI_CANNOT_PARSE_RESPONSE: 'cannot parse response',
    GATEWAY_TIMEOUT: 'Gateway Timeout',
    KIROKU_SERVICE_INTERRUPTED: 'Kiroku service interrupted',
    DUPLICATE_RECORD: 'A record already exists with this ID',

    // The "Upgrade" is intentional as the 426 HTTP code means "Upgrade Required" and sent by the API. We use the "Update" language everywhere else in the front end when this gets returned.
    UPDATE_REQUIRED: 'Upgrade Required',
  },
  EVENTS: {
    SCROLLING: 'scrolling',
  },

  EXCLUDE_FROM_LAST_VISITED_PATH: [
    SCREENS.NOT_FOUND,
    // SCREENS.SAML_SIGN_IN,
    // SCREENS.VALIDATE_LOGIN,
  ] as string[],

  // Character Limits
  FORM_CHARACTER_LIMIT: 50,
  LEGAL_NAMES_CHARACTER_LIMIT: 150,
  LOGIN_CHARACTER_LIMIT: 254,
  CATEGORY_NAME_LIMIT: 256,
  TAG_NAME_LIMIT: 256,
  TITLE_CHARACTER_LIMIT: 100,
  DESCRIPTION_LIMIT: 1000,
  SESSION_NAME_CHARACTER_LIMIT: 80,

  FIREBASE_STORAGE_URL: 'https://firebasestorage.googleapis.com',
  FRIEND_REQUEST_STATUS: {
    SELF: 'self',
    SENT: 'sent',
    RECEIVED: 'received',
    FRIEND: 'friend',
    UNDEFINED: 'undefined',
  },
  HTTP_STATUS: {
    // When Cloudflare throttles
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    GATEWAY_TIMEOUT: 504,
    UNKNOWN_ERROR: 520,
  },

  SEARCH: {
    RESULTS_PAGE_SIZE: 50,
    DATA_TYPES: {
      SESSION: 'session',
    },
    ACTION_TYPES: {
      VIEW: 'view',
    },
    SORT_ORDER: {
      ASC: 'asc',
      DESC: 'desc',
    },
    STATUS: {
      SESSION: {
        ALL: 'all',
        FINISHED: 'finished',
      },
    },
    TABLE_COLUMNS: {
      DATE: 'date',
      DESCRIPTION: 'description',
      FROM: 'from',
      TO: 'to',
      CATEGORY: 'category',
      TAG: 'tag',
      TYPE: 'type',
      ACTION: 'action',
    },
    SYNTAX_OPERATORS: {
      AND: 'and',
      OR: 'or',
      EQUAL_TO: 'eq',
      NOT_EQUAL_TO: 'neq',
      GREATER_THAN: 'gt',
      GREATER_THAN_OR_EQUAL_TO: 'gte',
      LOWER_THAN: 'lt',
      LOWER_THAN_OR_EQUAL_TO: 'lte',
    },
    SYNTAX_ROOT_KEYS: {
      TYPE: 'type',
      STATUS: 'status',
      SORT_BY: 'sortBy',
      SORT_ORDER: 'sortOrder',
    },
    SYNTAX_FILTER_KEYS: {
      DATE: 'date',
      AMOUNT: 'amount',
      FROM: 'from',
      TO: 'to',
      CATEGORY: 'category',
      TAG: 'tag',
      KEYWORD: 'keyword',
      IN: 'in',
    },
  },

  ICON_TYPE_ICON: 'icon',
  ICON_TYPE_AVATAR: 'avatar',
  INVALID_CHARS: ['.', '#', '$', '[', ']'],
  JSON_CODE: {
    SUCCESS: 200,
    BAD_REQUEST: 400,
    NOT_AUTHENTICATED: 407,
    EXP_ERROR: 666,
    MANY_WRITES_ERROR: 665,
    UNABLE_TO_RETRY: 'unableToRetry',
    UPDATE_REQUIRED: 426,
  },
  PLATFORM_SPECIFIC_KEYS: {
    CTRL: {
      DEFAULT: 'control',
      [PLATFORM_OS_MACOS]: 'meta',
      [PLATFORM_IOS]: 'meta',
    },
    SHIFT: {
      DEFAULT: 'shift',
    },
  },
  ENVIRONMENT_SUFFIX: {
    DEV: ' Dev',
    ADHOC: ' AdHoc',
  },
  KEYBOARD_SHORTCUTS: {
    SEARCH: {
      descriptionKey: 'search',
      shortcutKey: 'K',
      modifiers: ['CTRL'],
      trigger: {
        DEFAULT: {input: 'k', modifierFlags: keyModifierControl},
        [PLATFORM_OS_MACOS]: {input: 'k', modifierFlags: keyModifierCommand},
        [PLATFORM_IOS]: {input: 'k', modifierFlags: keyModifierCommand},
      },
      type: KEYBOARD_SHORTCUT_NAVIGATION_TYPE,
    },
    NEW_CHAT: {
      descriptionKey: 'newChat',
      shortcutKey: 'K',
      modifiers: ['CTRL', 'SHIFT'],
      trigger: {
        DEFAULT: {input: 'k', modifierFlags: keyModifierShiftControl},
        [PLATFORM_OS_MACOS]: {
          input: 'k',
          modifierFlags: keyModifierShiftCommand,
        },
        [PLATFORM_IOS]: {input: 'k', modifierFlags: keyModifierShiftCommand},
      },
      type: KEYBOARD_SHORTCUT_NAVIGATION_TYPE,
    },
    SHORTCUTS: {
      descriptionKey: 'openShortcutDialog',
      shortcutKey: 'J',
      modifiers: ['CTRL'],
      trigger: {
        DEFAULT: {input: 'j', modifierFlags: keyModifierControl},
        [PLATFORM_OS_MACOS]: {input: 'j', modifierFlags: keyModifierCommand},
        [PLATFORM_IOS]: {input: 'j', modifierFlags: keyModifierCommand},
      },
    },
    ESCAPE: {
      descriptionKey: 'escape',
      shortcutKey: 'Escape',
      modifiers: [],
      trigger: {
        DEFAULT: {input: keyInputEscape},
        [PLATFORM_OS_MACOS]: {input: keyInputEscape},
        [PLATFORM_IOS]: {input: keyInputEscape},
      },
    },
    ENTER: {
      descriptionKey: null,
      shortcutKey: 'Enter',
      modifiers: [],
      trigger: {
        DEFAULT: {input: keyInputEnter},
        [PLATFORM_OS_MACOS]: {input: keyInputEnter},
        [PLATFORM_IOS]: {input: keyInputEnter},
      },
    },
    CTRL_ENTER: {
      descriptionKey: null,
      shortcutKey: 'Enter',
      modifiers: ['CTRL'],
      trigger: {
        DEFAULT: {input: keyInputEnter, modifierFlags: keyModifierControl},
        [PLATFORM_OS_MACOS]: {
          input: keyInputEnter,
          modifierFlags: keyModifierCommand,
        },
        [PLATFORM_IOS]: {
          input: keyInputEnter,
          modifierFlags: keyModifierCommand,
        },
      },
    },
    COPY: {
      descriptionKey: 'copy',
      shortcutKey: 'C',
      modifiers: ['CTRL'],
      trigger: {
        DEFAULT: {input: 'c', modifierFlags: keyModifierControl},
        [PLATFORM_OS_MACOS]: {input: 'c', modifierFlags: keyModifierCommand},
        [PLATFORM_IOS]: {input: 'c', modifierFlags: keyModifierCommand},
      },
    },
    ARROW_UP: {
      descriptionKey: null,
      shortcutKey: 'ArrowUp',
      modifiers: [],
      trigger: {
        DEFAULT: {input: keyInputUpArrow},
        [PLATFORM_OS_MACOS]: {input: keyInputUpArrow},
        [PLATFORM_IOS]: {input: keyInputUpArrow},
      },
    },
    ARROW_DOWN: {
      descriptionKey: null,
      shortcutKey: 'ArrowDown',
      modifiers: [],
      trigger: {
        DEFAULT: {input: keyInputDownArrow},
        [PLATFORM_OS_MACOS]: {input: keyInputDownArrow},
        [PLATFORM_IOS]: {input: keyInputDownArrow},
      },
    },
    ARROW_LEFT: {
      descriptionKey: null,
      shortcutKey: 'ArrowLeft',
      modifiers: [],
      trigger: {
        DEFAULT: {input: keyInputLeftArrow},
        [PLATFORM_OS_MACOS]: {input: keyInputLeftArrow},
        [PLATFORM_IOS]: {input: keyInputLeftArrow},
      },
    },
    ARROW_RIGHT: {
      descriptionKey: null,
      shortcutKey: 'ArrowRight',
      modifiers: [],
      trigger: {
        DEFAULT: {input: keyInputRightArrow},
        [PLATFORM_OS_MACOS]: {input: keyInputRightArrow},
        [PLATFORM_IOS]: {input: keyInputRightArrow},
      },
    },
    TAB: {
      descriptionKey: null,
      shortcutKey: 'Tab',
      modifiers: [],
    },
  },
  KEYBOARD_SHORTCUTS_TYPES: {
    NAVIGATION_SHORTCUT: KEYBOARD_SHORTCUT_NAVIGATION_TYPE,
  },
  KEYBOARD_SHORTCUT_KEY_DISPLAY_NAME: {
    CONTROL: 'CTRL',
    ESCAPE: 'ESC',
    META: 'CMD',
    SHIFT: 'Shift',
  },
  LOCAL_IMAGE_PREFIX: 'file://',
  LOCALES: {
    EN: 'en',
    CS_CZ: 'cs_CZ',

    DEFAULT: 'en',
  },
  MAX_ALLOWED_UNITS: 100,

  /**
   * Constants for maxToRenderPerBatch parameter that is used for FlatList or SectionList. This controls the amount of items rendered per batch, which is the next chunk of items
   * rendered on every scroll.
   */
  MAX_TO_RENDER_PER_BATCH: {
    DEFAULT: 5,
    CAROUSEL: 3,
  },

  /**
   * The maximum count of items per page for SelectionList.
   * When paginate, it multiplies by page number.
   */
  MAX_SELECTION_LIST_PAGE_LENGTH: 500,

  // These split the maximum decimal value of a signed 64-bit number (9,223,372,036,854,775,807) into parts where none of them are too big to fit into a 32-bit number, so that we can
  // generate them each with a random number generator with only 32-bits of precision.
  MAX_64BIT_LEFT_PART: 92233,
  MAX_64BIT_MIDDLE_PART: 7203685,
  MAX_64BIT_RIGHT_PART: 4775807,

  // Max email length
  EMAIL_MAX_LENGTH: 254,

  // When generating a random value to fit in 7 digits (for the `middle` or `right` parts above), this is the maximum value to multiply by Math.random().
  MAX_INT_FOR_RANDOM_7_DIGIT_VALUE: 10000000,
  MERGED_ACCOUNT_PREFIX: 'MERGED_',
  MODAL: {
    MODAL_TYPE: {
      CONFIRM: 'confirm',
      CENTERED: 'centered',
      CENTERED_UNSWIPEABLE: 'centered_unswipeable',
      CENTERED_SMALL: 'centered_small',
      BOTTOM_DOCKED: 'bottom_docked',
      POPOVER: 'popover',
      RIGHT_DOCKED: 'right_docked',
      ONBOARDING: 'onboarding',
    },
    ANCHOR_ORIGIN_VERTICAL: {
      TOP: 'top',
      CENTER: 'center',
      BOTTOM: 'bottom',
    },
    ANCHOR_ORIGIN_HORIZONTAL: {
      LEFT: 'left',
      CENTER: 'center',
      RIGHT: 'right',
    },
    POPOVER_MENU_PADDING: 8,
    RESTORE_FOCUS_TYPE: {
      DEFAULT: 'default',
      DELETE: 'delete',
      PRESERVE: 'preserve',
    },
  },
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

  ERROR_TYPE: {
    SOCKET: 'Kiroku\\Auth\\Error\\Socket',
  },
  ERROR_TITLE: {
    SOCKET: 'Issue connecting to database',
    DUPLICATE_RECORD: '400 Unique Constraints Violation',
  },
  FORMS: {
    // Forms to load upon onyx initialization
    LOGIN_FORM: 'LoginForm',
    // VALIDATE_CODE_FORM: 'ValidateCodeForm',
    // VALIDATE_TFA_CODE_FORM: 'ValidateTfaCodeForm',
    // RESEND_VALIDATION_FORM: 'ResendValidationForm',
    // UNLINK_LOGIN_FORM: 'UnlinkLoginForm',
    // RESEND_VALIDATE_CODE_FORM: 'ResendValidateCodeForm',
  },

  // at least 8 characters, 1 capital letter, 1 lowercase number, 1 number
  PASSWORD_COMPLEXITY_REGEX_STRING: '^(?=.*[A-Z])(?=.*[0-9])(?=.*[a-z]).{8,}$',

  KEYBOARD_TYPE: {
    VISIBLE_PASSWORD: 'visible-password',
    ASCII_CAPABLE: 'ascii-capable',
    NUMBER_PAD: 'number-pad',
    DECIMAL_PAD: 'decimal-pad',
  },

  INPUT_MODE: {
    NONE: 'none',
    TEXT: 'text',
    DECIMAL: 'decimal',
    NUMERIC: 'numeric',
    TEL: 'tel',
    SEARCH: 'search',
    EMAIL: 'email',
    URL: 'url',
  },

  SESSION_STORAGE_KEYS: {
    INITIAL_URL: 'INITIAL_URL',
    ACTIVE_WORKSPACE_ID: 'ACTIVE_WORKSPACE_ID',
    RETRY_LAZY_REFRESHED: 'RETRY_LAZY_REFRESHED',
  },

  NETWORK: {
    METHOD: {
      POST: 'post',
    },
    MIN_RETRY_WAIT_TIME_MS: 10,
    MAX_RANDOM_RETRY_WAIT_TIME_MS: 100,
    MAX_RETRY_WAIT_TIME_MS: 10 * 1000,
    PROCESS_REQUEST_DELAY_MS: 1000,
    MAX_PENDING_TIME_MS: 10 * 1000,
    RECHECK_INTERVAL_MS: 60 * 1000,
    MAX_REQUEST_RETRIES: 10,
    NETWORK_STATUS: {
      ONLINE: 'online',
      OFFLINE: 'offline',
      UNKNOWN: 'unknown',
    },
  },
  DEFAULT_TIME_ZONE: {automatic: true, selected: 'Europe/Prague'},
  DEFAULT_ACCOUNT_DATA: {errors: null, success: '', isLoading: false},
  DEFAULT_DELETE_ACCOUNT_DATA: {errors: null, success: '', isLoading: false},
  DEFAULT_NETWORK_DATA: {isOffline: false},

  MICROSECONDS_PER_MS: 1000,
  RED_BRICK_ROAD_PENDING_ACTION: {
    ADD: 'add',
    DELETE: 'delete',
    UPDATE: 'update',
  },
  BRICK_ROAD_INDICATOR_STATUS: {
    ERROR: 'error',
    INFO: 'info',
  },
  NO_IMAGE: 'NO_IMAGE', // Used for the profile avatar when there is no image
  ONYX_UPDATE_TYPES: {
    HTTPS: 'https',
    PUSHER: 'pusher',
    AIRSHIP: 'airship',
  },
  OPTION_MODE: {
    COMPACT: 'compact',
    DEFAULT: 'default',
  },
  OS: {
    WINDOWS: 'Windows',
    MAC_OS: 'Mac OS',
    ANDROID: 'Android',
    IOS: 'iOS',
    LINUX: 'Linux',
    NATIVE: 'Native',
  },
  PLATFORM: {
    IOS: 'iOS',
    ANDROID: 'Android',
    WEB: 'Web',
  },
  // Values for checking if polyfill is required on a platform
  POLYFILL_TEST: {
    STYLE: 'currency',
    CURRENCY: 'XAF',
    FORMAT: 'symbol',
    SAMPLE_INPUT: '123456.789',
    EXPECTED_OUTPUT: 'FCFA 123,457',
  },

  PUSHER: {
    PRIVATE_USER_CHANNEL_PREFIX: 'private-encrypted-user-userID-',
  },
  REGEX: {
    SPECIAL_CHARS_WITHOUT_NEWLINE: /((?!\n)[()-\s\t])/g,
    DIGITS_AND_PLUS: /^\+?[0-9]*$/,
    ALPHABETIC_AND_LATIN_CHARS: /^[\p{Script=Latin} ]*$/u,
    NON_ALPHABETIC_AND_NON_LATIN_CHARS: /[^\p{Script=Latin}]/gu,
    ACCENT_LATIN_CHARS: /[\u00C0-\u017F]/g,
    INVISIBLE_CHARACTERS_GROUPS: /[\p{C}\p{Z}]/gu,
    EMAIL:
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    OTHER_INVISIBLE_CHARACTERS: /[\u3164]/g,
    POSITIVE_INTEGER: /^\d+$/,
    ROUTES: {
      REDUNDANT_SLASHES: /(\/{2,})|(\/$)/g,
    },
    CODE_2FA: /^\d{6}$/,
    NUMBER: /^[0-9]+$/,
    CARD_NUMBER: /^[0-9]{15,16}$/,
    CARD_SECURITY_CODE: /^[0-9]{3,4}$/,
    CARD_EXPIRATION_DATE: /^(0[1-9]|1[0-2])([^0-9])?([0-9]{4}|([0-9]{2}))$/,
    TIME_FORMAT: /^\d{2}:\d{2} [AP]M$/,
    DATE_TIME_FORMAT: /^\d{2}-\d{2} \d{2}:\d{2} [AP]M$/,
    YEAR_DATE_TIME_FORMAT: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [AP]M$/,
  },

  /**
   * Acceptable values for the `role` attribute on react native components.
   *
   * **IMPORTANT:** Not for use with the `accessibilityRole` prop, as it accepts different values, and new components
   * should use the `role` prop instead.
   */
  ROLE: {
    /** Use for elements with important, time-sensitive information. */
    ALERT: 'alert',
    /** Use for elements that act as buttons. */
    BUTTON: 'button',
    /** Use for elements representing checkboxes. */
    CHECKBOX: 'checkbox',
    /** Use for elements that allow a choice from multiple options. */
    COMBOBOX: 'combobox',
    /** Use with scrollable lists to represent a grid layout. */
    GRID: 'grid',
    /** Use for section headers or titles. */
    HEADING: 'heading',
    /** Use for image elements. */
    IMG: 'img',
    /** Use for elements that navigate to other pages or content. */
    LINK: 'link',
    /** Use to identify a list of items. */
    LIST: 'list',
    /** Use for a list of choices or options. */
    MENU: 'menu',
    /** Use for a container of multiple menus. */
    MENUBAR: 'menubar',
    /** Use for items within a menu. */
    MENUITEM: 'menuitem',
    /** Use when no specific role is needed. */
    NONE: 'none',
    /** Use for elements that don't require a specific role. */
    PRESENTATION: 'presentation',
    /** Use for elements showing progress of a task. */
    PROGRESSBAR: 'progressbar',
    /** Use for radio buttons. */
    RADIO: 'radio',
    /** Use for groups of radio buttons. */
    RADIOGROUP: 'radiogroup',
    /** Use for scrollbar elements. */
    SCROLLBAR: 'scrollbar',
    /** Use for text fields that are used for searching. */
    SEARCHBOX: 'searchbox',
    /** Use for adjustable elements like sliders. */
    SLIDER: 'slider',
    /** Use for a button that opens a list of choices. */
    SPINBUTTON: 'spinbutton',
    /** Use for elements providing a summary of app conditions. */
    SUMMARY: 'summary',
    /** Use for on/off switch elements. */
    SWITCH: 'switch',
    /** Use for tab elements in a tab list. */
    TAB: 'tab',
    /** Use for a list of tabs. */
    TABLIST: 'tablist',
    /** Use for text elements */
    TEXT: 'text',
    /** Use for timer elements. */
    TIMER: 'timer',
    /** Use for toolbars containing action buttons or components. */
    TOOLBAR: 'toolbar',
  },

  SCREEN_READER_STATES: {
    ALL: 'all',
    ACTIVE: 'active',
    DISABLED: 'disabled',
  },
  SELECTION_SCRAPER_HIDDEN_ELEMENT: 'selection-scrapper-hidden-element',
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
  SPACE_CHARACTER_WIDTH: 4,
  STATUS_BAR_STYLE: {
    LIGHT_CONTENT: 'light-content',
    DARK_CONTENT: 'dark-content',
  },
  STORE_LINKS: {
    ANDROID: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`,
    IOS: 'https://testflight.apple.com/join/DgY9IieL',
    DESKTOP: '',
  },
  TOOLTIP_MAX_LINES: 3,
  THEME: {
    DEFAULT: 'light', // was 'system'
    FALLBACK: 'light', // was 'dark
    DARK: 'dark',
    LIGHT: 'light',
    SYSTEM: 'system',
  },
  TEST_TOOL: {
    // Number of concurrent taps to open then the Test modal menu
    NUMBER_OF_TAPS: 4,
  },
  TIMING: {
    HOMEPAGE_INITIAL_RENDER: 'homepage_initial_render',
    SEARCH_RENDER: 'search_render',
    COLD: 'cold',
    WARM: 'warm',
    COMMENT_LENGTH_DEBOUNCE_TIME: 500,
    RESIZE_DEBOUNCE_TIME: 100,
    SEARCH_OPTION_LIST_DEBOUNCE_TIME: 300,
    TOOLTIP_SENSE: 1000,
  },
  TIME_PERIOD: {
    AM: 'AM',
    PM: 'PM',
  },
  INDENTS: '    ',
  TWO_FACTOR_AUTH_STEPS: {
    CODES: 'CODES',
    VERIFY: 'VERIFY',
    SUCCESS: 'SUCCESS',
    ENABLED: 'ENABLED',
    DISABLED: 'DISABLED',
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

  // 6 numeric digits
  VALIDATE_CODE_REGEX_STRING: /^\d{6}$/,

  // 8 alphanumeric characters
  RECOVERY_CODE_REGEX_STRING: /^[a-zA-Z0-9]{8}$/,

  UNICODE: {
    LTR: '\u2066',
  },

  // The server has a WAF (Web Application Firewall) which will strip out HTML/XML tags using this regex pattern.
  // It's copied here so that the same regex pattern can be used in form validations to be consistent with the server.
  VALIDATE_FOR_HTML_TAG_REGEX: /<([^>\s]+)(?:[^>]*?)>/g,

  VALIDATE_FOR_LEADINGSPACES_HTML_TAG_REGEX: /<([\s]+.+[\s]*)>/g,

  VIDEO_PLAYER: {
    POPOVER_Y_OFFSET: -30,
    PLAYBACK_SPEEDS: [0.25, 0.5, 1, 1.5, 2],
    HIDE_TIME_TEXT_WIDTH: 250,
    MIN_WIDTH: 170,
    MIN_HEIGHT: 120,
    CONTROLS_POSITION: {
      NATIVE: 32,
      NORMAL: 8,
    },
    DEFAULT_VIDEO_DIMENSIONS: {width: 1900, height: 1400},
  },

  WHITELISTED_TAGS: [/<>/, /< >/, /<->/, /<-->/, /<br>/, /<br\/>/],

  /**
   * native IDs for close buttons in Overlay component
   */
  OVERLAY: {
    TOP_BUTTON_NATIVE_ID: 'overLayTopButton',
    BOTTOM_BUTTON_NATIVE_ID: 'overLayBottomButton',
  },

  BACK_BUTTON_NATIVE_ID: 'backButton',

  WEEK_STARTS_ON: 1, // Monday

  ALL_COUNTRIES: {
    AF: 'Afghanistan',
    AX: 'Åland Islands',
    AL: 'Albania',
    DZ: 'Algeria',
    AS: 'American Samoa',
    AD: 'Andorra',
    AO: 'Angola',
    AI: 'Anguilla',
    AQ: 'Antarctica',
    AG: 'Antigua & Barbuda',
    AR: 'Argentina',
    AM: 'Armenia',
    AW: 'Aruba',
    AC: 'Ascension Island',
    AU: 'Australia',
    AT: 'Austria',
    AZ: 'Azerbaijan',
    BS: 'Bahamas',
    BH: 'Bahrain',
    BD: 'Bangladesh',
    BB: 'Barbados',
    BY: 'Belarus',
    BE: 'Belgium',
    BZ: 'Belize',
    BJ: 'Benin',
    BM: 'Bermuda',
    BT: 'Bhutan',
    BO: 'Bolivia',
    BA: 'Bosnia & Herzegovina',
    BW: 'Botswana',
    BR: 'Brazil',
    IO: 'British Indian Ocean Territory',
    VG: 'British Virgin Islands',
    BN: 'Brunei',
    BG: 'Bulgaria',
    BF: 'Burkina Faso',
    BI: 'Burundi',
    KH: 'Cambodia',
    CM: 'Cameroon',
    CA: 'Canada',
    CV: 'Cape Verde',
    BQ: 'Caribbean Netherlands',
    KY: 'Cayman Islands',
    CF: 'Central African Republic',
    TD: 'Chad',
    CL: 'Chile',
    CN: 'China',
    CX: 'Christmas Island',
    CC: 'Cocos (Keeling) Islands',
    CO: 'Colombia',
    KM: 'Comoros',
    CG: 'Congo - Brazzaville',
    CD: 'Congo - Kinshasa',
    CK: 'Cook Islands',
    CR: 'Costa Rica',
    CI: "Côte d'Ivoire",
    HR: 'Croatia',
    CU: 'Cuba',
    CW: 'Curaçao',
    CY: 'Cyprus',
    CZ: 'Czech Republic',
    DK: 'Denmark',
    DJ: 'Djibouti',
    DM: 'Dominica',
    DO: 'Dominican Republic',
    EC: 'Ecuador',
    EG: 'Egypt',
    SV: 'El Salvador',
    GQ: 'Equatorial Guinea',
    ER: 'Eritrea',
    EE: 'Estonia',
    ET: 'Ethiopia',
    FK: 'Falkland Islands',
    FO: 'Faroe Islands',
    FJ: 'Fiji',
    FI: 'Finland',
    FR: 'France',
    GF: 'French Guiana',
    PF: 'French Polynesia',
    TF: 'French Southern Territories',
    GA: 'Gabon',
    GM: 'Gambia',
    GE: 'Georgia',
    DE: 'Germany',
    GH: 'Ghana',
    GI: 'Gibraltar',
    GR: 'Greece',
    GL: 'Greenland',
    GD: 'Grenada',
    GP: 'Guadeloupe',
    GU: 'Guam',
    GT: 'Guatemala',
    GG: 'Guernsey',
    GN: 'Guinea',
    GW: 'Guinea-Bissau',
    GY: 'Guyana',
    HT: 'Haiti',
    HN: 'Honduras',
    HK: 'Hong Kong',
    HU: 'Hungary',
    IS: 'Iceland',
    IN: 'India',
    ID: 'Indonesia',
    IR: 'Iran',
    IQ: 'Iraq',
    IE: 'Ireland',
    IM: 'Isle of Man',
    IL: 'Israel',
    IT: 'Italy',
    JM: 'Jamaica',
    JP: 'Japan',
    JE: 'Jersey',
    JO: 'Jordan',
    KZ: 'Kazakhstan',
    KE: 'Kenya',
    KI: 'Kiribati',
    XK: 'Kosovo',
    KW: 'Kuwait',
    KG: 'Kyrgyzstan',
    LA: 'Laos',
    LV: 'Latvia',
    LB: 'Lebanon',
    LS: 'Lesotho',
    LR: 'Liberia',
    LY: 'Libya',
    LI: 'Liechtenstein',
    LT: 'Lithuania',
    LU: 'Luxembourg',
    MO: 'Macau',
    MK: 'Macedonia',
    MG: 'Madagascar',
    MW: 'Malawi',
    MY: 'Malaysia',
    MV: 'Maldives',
    ML: 'Mali',
    MT: 'Malta',
    MH: 'Marshall Islands',
    MQ: 'Martinique',
    MR: 'Mauritania',
    MU: 'Mauritius',
    YT: 'Mayotte',
    MX: 'Mexico',
    FM: 'Micronesia',
    MD: 'Moldova',
    MC: 'Monaco',
    MN: 'Mongolia',
    ME: 'Montenegro',
    MS: 'Montserrat',
    MA: 'Morocco',
    MZ: 'Mozambique',
    MM: 'Myanmar (Burma)',
    NA: 'Namibia',
    NR: 'Nauru',
    NP: 'Nepal',
    NL: 'Netherlands',
    NC: 'New Caledonia',
    NZ: 'New Zealand',
    NI: 'Nicaragua',
    NE: 'Niger',
    NG: 'Nigeria',
    NU: 'Niue',
    NF: 'Norfolk Island',
    KP: 'North Korea',
    MP: 'Northern Mariana Islands',
    NO: 'Norway',
    OM: 'Oman',
    PK: 'Pakistan',
    PW: 'Palau',
    PS: 'Palestinian Territories',
    PA: 'Panama',
    PG: 'Papua New Guinea',
    PY: 'Paraguay',
    PE: 'Peru',
    PH: 'Philippines',
    PN: 'Pitcairn Islands',
    PL: 'Poland',
    PT: 'Portugal',
    PR: 'Puerto Rico',
    QA: 'Qatar',
    RE: 'Réunion',
    RO: 'Romania',
    RU: 'Russia',
    RW: 'Rwanda',
    BL: 'Saint Barthélemy',
    WS: 'Samoa',
    SM: 'San Marino',
    ST: 'São Tomé & Príncipe',
    SA: 'Saudi Arabia',
    SN: 'Senegal',
    RS: 'Serbia',
    SC: 'Seychelles',
    SL: 'Sierra Leone',
    SG: 'Singapore',
    SX: 'Sint Maarten',
    SK: 'Slovakia',
    SI: 'Slovenia',
    SB: 'Solomon Islands',
    SO: 'Somalia',
    ZA: 'South Africa',
    GS: 'South Georgia & South Sandwich Islands',
    KR: 'South Korea',
    SS: 'South Sudan',
    ES: 'Spain',
    LK: 'Sri Lanka',
    SH: 'St. Helena',
    KN: 'St. Kitts & Nevis',
    LC: 'St. Lucia',
    MF: 'St. Martin',
    PM: 'St. Pierre & Miquelon',
    VC: 'St. Vincent & Grenadines',
    SD: 'Sudan',
    SR: 'Suriname',
    SJ: 'Svalbard & Jan Mayen',
    SZ: 'Swaziland',
    SE: 'Sweden',
    CH: 'Switzerland',
    SY: 'Syria',
    TW: 'Taiwan',
    TJ: 'Tajikistan',
    TZ: 'Tanzania',
    TH: 'Thailand',
    TL: 'Timor-Leste',
    TG: 'Togo',
    TK: 'Tokelau',
    TO: 'Tonga',
    TT: 'Trinidad & Tobago',
    TA: 'Tristan da Cunha',
    TN: 'Tunisia',
    TR: 'Turkey',
    TM: 'Turkmenistan',
    TC: 'Turks & Caicos Islands',
    TV: 'Tuvalu',
    UM: 'U.S. Outlying Islands',
    VI: 'U.S. Virgin Islands',
    UG: 'Uganda',
    UA: 'Ukraine',
    AE: 'United Arab Emirates',
    GB: 'United Kingdom',
    US: 'United States',
    UY: 'Uruguay',
    UZ: 'Uzbekistan',
    VU: 'Vanuatu',
    VA: 'Vatican City',
    VE: 'Venezuela',
    VN: 'Vietnam',
    WF: 'Wallis & Futuna',
    EH: 'Western Sahara',
    YE: 'Yemen',
    ZM: 'Zambia',
    ZW: 'Zimbabwe',
  },
} as const;

type Country = keyof typeof CONST.ALL_COUNTRIES;

export type {Country};

export default CONST;
