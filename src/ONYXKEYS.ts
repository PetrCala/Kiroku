import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import type CONST from './CONST';
import type * as FormTypes from './types/form';
import type * as OnyxTypes from './types/onyx';
import type AssertTypesEqual from './types/utils/AssertTypesEqual';
import type DeepValueOf from './types/utils/DeepValueOf';
import type {Timestamp} from './types/onyx/OnyxCommon';

/**
 * This is a file containing constants for all the top level keys in the onyx store
 */
const ONYXKEYS = {
  //   /** A unique ID for the device */
  DEVICE_ID: 'deviceID',

  //   /** Boolean flag set whenever the sidebar has loaded */
  IS_SIDEBAR_LOADED: 'isSidebarLoaded',

  /** Note: These are Persisted Requests - not all requests in the main queue as the key name might lead one to believe */
  PERSISTED_REQUESTS: 'networkRequestQueue',
  PERSISTED_ONGOING_REQUESTS: 'networkOngoingRequestQueue',

  /** Credentials to authenticate the user */
  CREDENTIALS: 'credentials',
  STASHED_CREDENTIALS: 'stashedCredentials',

  /** This NVP contains information about whether the timezone fix was completed or not */
  NVP_TZ_FIX: 'nvp_tz_fix',

  /** Stores current date */
  CURRENT_DATE: 'currentDate',

  /** The last session create action taken (for the Start Session Button) */
  START_SESSION_GLOBAL_CREATE: 'startSessionGlobalCreate',

  /** Keeps track if there is modal currently visible or not */
  MODAL: 'modal',

  //   /** Has information about the network status (offline/online) */
  NETWORK: 'network',

  /** Contains all the userData the user has access to, keyed by userID */
  USER_DATA_LIST: 'userDataList',

  /** Contains all the private user data details of the user */
  USER_PRIVATE_DATA: 'private_userData',

  /**
   * USER_DATA_METADATA is a perf optimization used to hold loading states of each entry in USER_DATA_LIST.
   * A lot of components are connected to the USER_DATA_LIST entity and do not care about the loading state.
   * Setting the loading state directly on the personal details entry caused a lot of unnecessary re-renders.
   */
  USER_DATA_METADATA: 'personalDetailsMetadata',

  /** Indicates whether an update is available and ready to be installed. */
  UPDATE_AVAILABLE: 'updateAvailable',

  //   /** Indicates that a request to join a screen share with a GuidesPlus agent was received */
  //   SCREEN_SHARE_REQUEST: 'screenShareRequest',

  /** Saves the current country code which is displayed when the user types a phone number without
   *  an international code */
  COUNTRY_CODE: 'countryCode',

  //   /**  The 'country' field in this code represents the return country based on the user's IP address.
  //    * It is expected to provide a two-letter country code such as US for United States, and so on. */
  //   COUNTRY: 'country',

  /** Contains all the users settings for the Settings page and sub pages */
  USER: 'user',

  /** Contains latitude and longitude of user's last known location */
  USER_LOCATION: 'userLocation',

  //   /** Information about the current session (authToken, userID, email, loading, error) */
  SESSION: 'session',
  //   STASHED_SESSION: 'stashedSession',
  // BETAS: 'betas',

  //   /** Indicates which locale should be used */
  NVP_PREFERRED_LOCALE: 'nvp_preferredLocale',

  //   /** Does this user have push notifications enabled for this device? */
  PUSH_NOTIFICATIONS_ENABLED: 'pushNotificationsEnabled',

  /** Boolean flag used to display the focus mode notification */
  FOCUS_MODE_NOTIFICATION: 'focusModeNotification',

  /** Ongoing session data */
  ONGOING_SESSION_DATA: 'ongoingSessionData',

  /** Edit session data */
  EDIT_SESSION_DATA: 'editSessionData',

  /** Whether the user is in a process of creating a new session */
  IS_CREATING_NEW_SESSION: 'isCreatingNewSession',

  /** How many months of the calendar the user has loaded already */
  SESSIONS_CALENDAR_MONTHS_LOADED: 'sessionsCalendarMonthsLoaded',

  /** Is the app loading? */
  IS_LOADING_APP: 'isLoadingApp',

  /** Text to show when the app is loading */
  APP_LOADING_TEXT: 'appLoadingText',

  /** Is the test tools modal open? */
  IS_TEST_TOOLS_MODAL_OPEN: 'isTestToolsModalOpen',

  /** Whether we should show the compose input or not */
  SHOULD_SHOW_COMPOSE_INPUT: 'shouldShowComposeInput',

  /** The last time a user has dismissed the app update modal */
  APP_UPDATE_DISMISSED: 'appUpdateDismissed',

  /** The last time a user has sent a verification email */
  VERIFY_EMAIL_SENT: 'verifyEmailSent',

  /** The last time a user dismissed the verify email value */
  VERIFY_EMAIL_DISMISSED: 'verifyEmailDismissed',

  /** Is app in beta version */
  IS_BETA: 'isBeta',

  /** Whether we've checked if the user can auto login */
  HAS_CHECKED_AUTO_LOGIN: 'hasCheckedAutoLogin',

  //   // The theme setting set by the user in preferences.
  //   // This can be either "light", "dark" or "system"
  PREFERRED_THEME: 'preferredTheme',

  //   // Information about the onyx updates IDs that were received from the server
  ONYX_UPDATES_FROM_SERVER: 'onyxUpdatesFromServer',

  //   // The last update ID that was applied to the client
  ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT:
    'OnyxUpdatesLastUpdateIDAppliedToClient',

  /** Stores last visited path */
  LAST_VISITED_PATH: 'lastVisitedPath',

  /** Stores the route to open after changing app permission from settings */
  LAST_ROUTE: 'lastRoute',

  //   // Stores the recently used report fields
  //   RECENTLY_USED_REPORT_FIELDS: 'recentlyUsedReportFields',

  /** Indicates whether an forced upgrade is required */
  UPDATE_REQUIRED: 'updateRequired',

  /** Stores the logs of the app for debugging purposes */
  LOGS: 'logs',

  /** Indicates whether we should store logs or not */
  SHOULD_STORE_LOGS: 'shouldStoreLogs',

  //   /** Collection Keys */
  COLLECTION: {
    DOWNLOAD: 'download_',
    DRINKS: 'drinks_',
    DRINKING_SESSION: 'drinkingSession_',
    //     POLICY: 'policy_',
    //     POLICY_TAGS: 'policyTags_',
    //     POLICY_RECENTLY_USED_TAGS: 'nvp_recentlyUsedTags_',
    //     REPORT: 'report_',
  },

  //   /** List of Form ids */
  FORMS: {
    LOG_IN_FORM: 'logInForm',
    LOG_IN_FORM_DRAFT: 'logInFormDraft',
    SIGN_UP_FORM: 'signUpForm',
    SIGN_UP_FORM_DRAFT: 'signUpFormDraft',
    // ADD_DEBIT_CARD_FORM: 'addDebitCardForm',
    CLOSE_ACCOUNT_FORM: 'closeAccount',
    CLOSE_ACCOUNT_FORM_DRAFT: 'closeAccountDraft',
    //     PROFILE_SETTINGS_FORM: 'profileSettingsForm',
    //     PROFILE_SETTINGS_FORM_DRAFT: 'profileSettingsFormDraft',
    DISPLAY_NAME_FORM: 'displayNameForm',
    DISPLAY_NAME_FORM_DRAFT: 'displayNameFormDraft',
    USER_NAME_FORM: 'userNameForm',
    USER_NAME_FORM_DRAFT: 'userNameFormDraft',
    //     ONBOARDING_USER_DATA_FORM: 'onboardingUserDataForm',
    //     ONBOARDING_USER_DATA_FORM_DRAFT:
    //       'onboardingUserDataFormDraft',
    LEGAL_NAME_FORM: 'legalNameForm',
    LEGAL_NAME_FORM_DRAFT: 'legalNameFormDraft',
    DATE_OF_BIRTH_FORM: 'dateOfBirthForm',
    DATE_OF_BIRTH_FORM_DRAFT: 'dateOfBirthFormDraft',
    EMAIL_FORM: 'emailForm',
    EMAIL_FORM_DRAFT: 'emailFormDraft',
    FORGOT_PASSWORD_FORM: 'forgotPasswordForm',
    FORGOT_PASSWORD_FORM_DRAFT: 'forgotPasswordFormDraft',
    PASSWORD_FORM: 'passwordForm',
    PASSWORD_FORM_DRAFT: 'passwordFormDraft',
    REPORT_BUG_FORM: 'reportBugForm',
    REPORT_BUG_FORM_DRAFT: 'reportBugFormDraft',
    FEEDBACK_FORM: 'feedbackForm',
    FEEDBACK_FORM_DRAFT: 'feedbackFormDraft',
    SESSION_DATE_FORM: 'sessionDateForm',
    SESSION_DATE_FORM_DRAFT: 'sessionDateFormDraft',
    SESSION_NOTE_FORM: 'sessionNoteForm',
    SESSION_NOTE_FORM_DRAFT: 'sessionNoteFormDraft',
  },
} as const;

type AllOnyxKeys = DeepValueOf<typeof ONYXKEYS>;

type OnyxFormValuesMapping = {
  [ONYXKEYS.FORMS.LOG_IN_FORM]: FormTypes.LogInForm;
  [ONYXKEYS.FORMS.SIGN_UP_FORM]: FormTypes.SignUpForm;
  [ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM]: FormTypes.CloseAccountForm;
  //   [ONYXKEYS.FORMS.PROFILE_SETTINGS_FORM]: FormTypes.ProfileSettingsForm;
  [ONYXKEYS.FORMS.DISPLAY_NAME_FORM]: FormTypes.DisplayNameForm;
  [ONYXKEYS.FORMS.USER_NAME_FORM]: FormTypes.UserNameForm;
  [ONYXKEYS.FORMS.LEGAL_NAME_FORM]: FormTypes.LegalNameForm;
  [ONYXKEYS.FORMS.DATE_OF_BIRTH_FORM]: FormTypes.DateOfBirthForm;
  // [ONYXKEYS.FORMS.HOME_ADDRESS_FORM]: FormTypes.HomeAddressForm;
  //   [ONYXKEYS.FORMS.EXIT_SURVEY_REASON_FORM]: FormTypes.ExitSurveyReasonForm;
  //   [ONYXKEYS.FORMS.EXIT_SURVEY_RESPONSE_FORM]: FormTypes.ExitSurveyResponseForm;
  //   [ONYXKEYS.FORMS
  //     .SETTINGS_STATUS_CLEAR_DATE_FORM]: FormTypes.SettingsStatusClearDateForm;
  //   [ONYXKEYS.FORMS
  //     .SETTINGS_STATUS_SET_CLEAR_AFTER_FORM]: FormTypes.SettingsStatusSetClearAfterForm;
  //   [ONYXKEYS.FORMS.PRIVATE_NOTES_FORM]: FormTypes.PrivateNotesForm;
  [ONYXKEYS.FORMS.EMAIL_FORM]: FormTypes.EmailForm;
  [ONYXKEYS.FORMS.FORGOT_PASSWORD_FORM]: FormTypes.ForgotPasswordForm;
  [ONYXKEYS.FORMS.PASSWORD_FORM]: FormTypes.PasswordForm;
  [ONYXKEYS.FORMS.REPORT_BUG_FORM]: FormTypes.ReportBugForm;
  [ONYXKEYS.FORMS.FEEDBACK_FORM]: FormTypes.FeedbackForm;
  [ONYXKEYS.FORMS.SESSION_DATE_FORM]: FormTypes.SessionDateForm;
  [ONYXKEYS.FORMS.SESSION_NOTE_FORM]: FormTypes.SessionNoteForm;
};

type OnyxFormDraftValuesMapping = {
  [K in keyof OnyxFormValuesMapping as `${K}Draft`]: OnyxFormValuesMapping[K];
};

type OnyxCollectionValuesMapping = {
  [ONYXKEYS.COLLECTION.DOWNLOAD]: OnyxTypes.Download;
  [ONYXKEYS.COLLECTION.DRINKS]: OnyxTypes.Drinks;
  [ONYXKEYS.COLLECTION.DRINKING_SESSION]: OnyxTypes.DrinkingSession;
  //   [ONYXKEYS.COLLECTION.POLICY]: OnyxTypes.Policy;
  //   [ONYXKEYS.COLLECTION.POLICY_DRAFTS]: OnyxTypes.Policy;
  //     .POLICY_RECENTLY_USED_CATEGORIES]: OnyxTypes.RecentlyUsedCategories;
  //   [ONYXKEYS.COLLECTION.DEPRECATED_POLICY_MEMBER_LIST]: OnyxTypes.PolicyMembers;
};

type OnyxValuesMapping = {
  [ONYXKEYS.NVP_TZ_FIX]: OnyxTypes.TzFix | [];
  //   [ONYXKEYS.ACCOUNT_MANAGER_REPORT_ID]: string;
  //   [ONYXKEYS.NVP_IS_FIRST_TIME_NEW_EXPENSIFY_USER]: boolean;
  //   [ONYXKEYS.ACTIVE_CLIENTS]: string[];
  [ONYXKEYS.DEVICE_ID]: string;
  [ONYXKEYS.IS_SIDEBAR_LOADED]: boolean;
  [ONYXKEYS.PERSISTED_REQUESTS]: OnyxTypes.Request[];
  [ONYXKEYS.PERSISTED_ONGOING_REQUESTS]: OnyxTypes.Request;
  [ONYXKEYS.CURRENT_DATE]: string;
  [ONYXKEYS.CREDENTIALS]: OnyxTypes.Credentials;
  [ONYXKEYS.STASHED_CREDENTIALS]: OnyxTypes.Credentials;
  [ONYXKEYS.START_SESSION_GLOBAL_CREATE]: OnyxTypes.StartSession;
  [ONYXKEYS.MODAL]: OnyxTypes.Modal;
  [ONYXKEYS.NETWORK]: OnyxTypes.Network;
  //   [ONYXKEYS.NEW_GROUP_CHAT_DRAFT]: OnyxTypes.NewGroupChatDraft;
  //   [ONYXKEYS.CUSTOM_STATUS_DRAFT]: OnyxTypes.CustomStatusDraft;
  //   [ONYXKEYS.INPUT_FOCUSED]: boolean;
  [ONYXKEYS.USER_DATA_LIST]: OnyxTypes.UserDataList;
  [ONYXKEYS.USER_PRIVATE_DATA]: OnyxTypes.UserPrivateData;
  [ONYXKEYS.USER_DATA_METADATA]: Record<string, OnyxTypes.UserDataMetadata>;
  [ONYXKEYS.UPDATE_AVAILABLE]: boolean;
  [ONYXKEYS.COUNTRY_CODE]: number;
  //   [ONYXKEYS.COUNTRY]: string;
  [ONYXKEYS.USER]: OnyxTypes.User;
  [ONYXKEYS.USER_LOCATION]: OnyxTypes.UserLocation;
  [ONYXKEYS.SESSION]: OnyxTypes.Session;
  [ONYXKEYS.FOCUS_MODE_NOTIFICATION]: boolean;
  [ONYXKEYS.PUSH_NOTIFICATIONS_ENABLED]: boolean;
  [ONYXKEYS.NVP_PREFERRED_LOCALE]: OnyxTypes.Locale;
  [ONYXKEYS.ONGOING_SESSION_DATA]: OnyxTypes.DrinkingSession;
  [ONYXKEYS.EDIT_SESSION_DATA]: OnyxTypes.DrinkingSession;
  [ONYXKEYS.IS_CREATING_NEW_SESSION]: boolean;
  [ONYXKEYS.SESSIONS_CALENDAR_MONTHS_LOADED]: number;
  [ONYXKEYS.APP_LOADING_TEXT]: string;
  //   [ONYXKEYS.IS_TEST_TOOLS_MODAL_OPEN]: boolean;
  //   [ONYXKEYS.APP_PROFILING_IN_PROGRESS]: boolean;
  [ONYXKEYS.IS_LOADING_APP]: boolean;
  [ONYXKEYS.IS_TEST_TOOLS_MODAL_OPEN]: boolean;
  [ONYXKEYS.SHOULD_SHOW_COMPOSE_INPUT]: boolean;
  [ONYXKEYS.APP_UPDATE_DISMISSED]: Timestamp;
  [ONYXKEYS.VERIFY_EMAIL_SENT]: Timestamp;
  [ONYXKEYS.VERIFY_EMAIL_DISMISSED]: Timestamp;
  [ONYXKEYS.IS_BETA]: boolean;
  [ONYXKEYS.HAS_CHECKED_AUTO_LOGIN]: boolean;
  [ONYXKEYS.PREFERRED_THEME]: ValueOf<typeof CONST.THEME>;
  [ONYXKEYS.ONYX_UPDATES_FROM_SERVER]: OnyxTypes.OnyxUpdatesFromServer;
  [ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT]: number;
  [ONYXKEYS.LAST_VISITED_PATH]: string | undefined;
  [ONYXKEYS.LAST_ROUTE]: string;
  [ONYXKEYS.UPDATE_REQUIRED]: boolean;
  [ONYXKEYS.LOGS]: OnyxTypes.CapturedLogs;
  [ONYXKEYS.SHOULD_STORE_LOGS]: boolean;
};

type OnyxValues = OnyxValuesMapping &
  OnyxCollectionValuesMapping &
  OnyxFormValuesMapping &
  OnyxFormDraftValuesMapping;

type OnyxCollectionKey = keyof OnyxCollectionValuesMapping;
type OnyxFormKey = keyof OnyxFormValuesMapping;
type OnyxFormDraftKey = keyof OnyxFormDraftValuesMapping;
type OnyxValueKey = keyof OnyxValuesMapping;

type OnyxKey =
  | OnyxValueKey
  | OnyxCollectionKey
  | OnyxFormKey
  | OnyxFormDraftKey;
type OnyxValue<TOnyxKey extends OnyxKey> =
  TOnyxKey extends keyof OnyxCollectionValuesMapping
    ? OnyxCollection<OnyxValues[TOnyxKey]>
    : OnyxEntry<OnyxValues[TOnyxKey]>;

type MissingOnyxKeysError =
  `Error: Types don't match, OnyxKey type is missing: ${Exclude<
    AllOnyxKeys,
    OnyxKey
  >}`;
/** If this type errors, it means that the `OnyxKey` type is missing some keys. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertOnyxKeys = AssertTypesEqual<
  AllOnyxKeys,
  OnyxKey,
  MissingOnyxKeysError
>;

export default ONYXKEYS;
export type {
  OnyxValues,
  OnyxKey,
  OnyxCollectionKey,
  OnyxValue,
  OnyxValueKey,
  OnyxFormKey,
  OnyxFormValuesMapping,
  OnyxFormDraftKey,
  OnyxCollectionValuesMapping,
};
