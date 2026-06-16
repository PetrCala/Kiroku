import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import type CONST from './CONST';
import type * as FormTypes from './types/form';
import type * as OnyxTypes from './types/onyx';
import type AssertTypesEqual from './types/utils/AssertTypesEqual';
import type DeepValueOf from './types/utils/DeepValueOf';
import type {DateString, Timestamp} from './types/onyx/OnyxCommon';

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

  /**
   * Raw OAuth materials stashed when Apple/Google sign-in collides with an
   * existing email/password account. Read by the collision-resolution modal
   * to prompt for the existing password and call linkWithCredential.
   * Ephemeral: cleared on link, cancel, and cleanupSession.
   */
  PENDING_OAUTH_CREDENTIAL: 'pendingOAuthCredential',

  /** Onboarding progress for the current user (completed_at, last_visited_path) */
  NVP_ONBOARDING: 'nvp_onboarding',

  /** Version of the Terms & Conditions the user has most recently accepted */
  NVP_TERMS_ACCEPTED_VERSION: 'nvp_termsAcceptedVersion',

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

  /**
   * Per-friend offline-feedback state (pendingAction + dismissible errors),
   * keyed by the counterpart's userID. Client-only: the server never writes
   * this, so it survives `/v1/updates` + Pusher userData merges.
   */
  FRIENDS_METADATA: 'friendsMetadata',

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

  /** Saves the current country code which is displayed when the user types a phone number without
   *  an international code */
  COUNTRY_CODE: 'countryCode',

  /** Contains all the users settings for the Settings page and sub pages */
  USER: 'user',

  /** Contains latitude and longitude of user's last known location */
  USER_LOCATION: 'userLocation',

  //   /** Information about the current session (authToken, userID, email, loading, error) */
  SESSION: 'session',

  //   /** Indicates which locale should be used */
  NVP_PREFERRED_LOCALE: 'nvp_preferredLocale',

  /** Per-viewed-user map of the day last seen in an enlarged calendar /
   *  day-overview scroll, keyed by the viewed user's ID. Consumed by the home &
   *  profile calendars so navigating back lands on the date the user was looking
   *  at — for the signed-in user AND for friends, each independently (one user's
   *  entry never affects another's; Rule 2). Reset (whole map) on app launch so
   *  every user's calendar opens on today the first time it's viewed per session. */
  NVP_LAST_VIEWED_CALENDAR_DATE: 'nvp_lastViewedCalendarDate',

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

  /**
   * Cached snapshot of the Firebase `user_drinking_sessions/{uid}` node, keyed
   * by userID. Used to seed the in-memory state on cold launch so the home
   * screen can render before the live listener resolves. Firebase remains the
   * source of truth; this is a render-time accelerator only.
   */
  CACHED_DRINKING_SESSIONS: 'cachedDrinkingSessions',

  /** Is the app loading? */
  IS_LOADING_APP: 'isLoadingApp',

  /** Text to show when the app is loading */
  APP_LOADING_TEXT: 'appLoadingText',

  /** Is the test tools modal open? */
  IS_TEST_TOOLS_MODAL_OPEN: 'isTestToolsModalOpen',

  /** Developer-only premium-feature gating overrides (Test Tools panel). Only
   *  read/written outside production — see `@libs/actions/FeatureAccess`. */
  FEATURE_ACCESS_OVERRIDES: 'featureAccessOverrides',

  /** Whether we should show the compose input or not */
  SHOULD_SHOW_COMPOSE_INPUT: 'shouldShowComposeInput',

  /** The last time a user has dismissed the app update modal */
  APP_UPDATE_DISMISSED: 'appUpdateDismissed',

  /** The last time a user has sent a verification email */
  VERIFY_EMAIL_SENT: 'verifyEmailSent',

  /** Is app in beta version */
  IS_BETA: 'isBeta',

  /** Whether we've checked if the user can auto login */
  HAS_CHECKED_AUTO_LOGIN: 'hasCheckedAutoLogin',

  //   // The theme setting set by the user in preferences.
  //   // This can be either "light", "dark" or "system"
  PREFERRED_THEME: 'preferredTheme',

  /** The signed-in user's preferences object, hydrated from `app/open`
   *  (kiroku-api) and kept in sync via the preferences write + `/v1/updates`. */
  PREFERENCES: 'preferences',

  /** The signed-in user's data-visibility settings, hydrated from `app/open`
   *  (kiroku-api) and echoed by the privacy write endpoints. Absent ⇒ fully
   *  visible (grandfathered default). */
  DATA_VISIBILITY: 'dataVisibility',

  /** Global app configuration (version gating, maintenance, terms-update
   *  timestamp). Hydrated from `app/open` (kiroku-api) and kept live via the
   *  public `config` Pusher broadcast — global + last-write-wins, so it bypasses
   *  the per-user OnyxUpdates gap-detection pipeline. */
  CONFIG: 'config',

  //   // Information about the onyx updates IDs that were received from the server
  ONYX_UPDATES_FROM_SERVER: 'onyxUpdatesFromServer',

  //   // The last update ID that was applied to the client
  ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT:
    'OnyxUpdatesLastUpdateIDAppliedToClient',

  /** Stores last visited path */
  LAST_VISITED_PATH: 'lastVisitedPath',

  /** Stores the route to open after changing app permission from settings */
  LAST_ROUTE: 'lastRoute',

  /** Indicates whether an forced upgrade is required */
  UPDATE_REQUIRED: 'updateRequired',

  /** Persisted filters for the Statistics tab navigator (range preset, custom range, drink-type subset). */
  STATISTICS_FILTERS: 'statisticsFilters',

  /** Stores the logs of the app for debugging purposes */
  LOGS: 'logs',

  /** Indicates whether we should store logs or not */
  SHOULD_STORE_LOGS: 'shouldStoreLogs',

  /** Admin-only: the full feedback collection, fetched on demand by SeeFeedbackScreen */
  FEEDBACK_LIST: 'feedbackList',

  /** Admin-only: the full bug-report collection, fetched on demand by SeeBugsScreen */
  BUG_LIST: 'bugList',

  //   /** Collection Keys */
  COLLECTION: {
    DOWNLOAD: 'download_',
    DRINKS: 'drinks_',
    DRINKING_SESSION: 'drinkingSession_',
    FEEDBACK: 'feedback_',
    BUG: 'bug_',
    /**
     * Per-user count of months the sessions calendar has been scrolled back.
     * Drives the Firebase `start_time` window for both the auth-user live
     * listener and the friend-profile one-shot fetcher.
     */
    SESSIONS_CALENDAR_MONTHS_BY_USER_ID: 'sessionsCalendarMonthsByUserID_',
    /**
     * Per-session map of drink-timestamp → GPS location, keyed by sessionId.
     * Sparse — only sessions where the user opted in to location tracking
     * during live capture have an entry. Mirrors the Firebase subtree at
     * `/user_session_locations/$uid/$sessionId`.
     */
    SESSION_LOCATIONS: 'sessionLocations_',
  },

  //   /** List of Form ids */
  FORMS: {
    AUTH_FORM: 'authForm',
    AUTH_FORM_DRAFT: 'authFormDraft',
    PICK_USERNAME_FORM: 'pickUsernameForm',
    PICK_USERNAME_FORM_DRAFT: 'pickUsernameFormDraft',
    CLOSE_ACCOUNT_FORM: 'closeAccount',
    CLOSE_ACCOUNT_FORM_DRAFT: 'closeAccountDraft',
    DISPLAY_NAME_FORM: 'displayNameForm',
    DISPLAY_NAME_FORM_DRAFT: 'displayNameFormDraft',
    USER_NAME_FORM: 'userNameForm',
    USER_NAME_FORM_DRAFT: 'userNameFormDraft',
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
    SESSION_NOTE_FORM: 'sessionNoteForm',
    SESSION_NOTE_FORM_DRAFT: 'sessionNoteFormDraft',
  },
} as const;

type AllOnyxKeys = DeepValueOf<typeof ONYXKEYS>;

type OnyxFormValuesMapping = {
  [ONYXKEYS.FORMS.AUTH_FORM]: FormTypes.AuthForm;
  [ONYXKEYS.FORMS.PICK_USERNAME_FORM]: FormTypes.PickUsernameForm;
  [ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM]: FormTypes.CloseAccountForm;
  [ONYXKEYS.FORMS.DISPLAY_NAME_FORM]: FormTypes.DisplayNameForm;
  [ONYXKEYS.FORMS.USER_NAME_FORM]: FormTypes.UserNameForm;
  [ONYXKEYS.FORMS.LEGAL_NAME_FORM]: FormTypes.LegalNameForm;
  [ONYXKEYS.FORMS.DATE_OF_BIRTH_FORM]: FormTypes.DateOfBirthForm;
  [ONYXKEYS.FORMS.EMAIL_FORM]: FormTypes.EmailForm;
  [ONYXKEYS.FORMS.FORGOT_PASSWORD_FORM]: FormTypes.ForgotPasswordForm;
  [ONYXKEYS.FORMS.PASSWORD_FORM]: FormTypes.PasswordForm;
  [ONYXKEYS.FORMS.REPORT_BUG_FORM]: FormTypes.ReportBugForm;
  [ONYXKEYS.FORMS.FEEDBACK_FORM]: FormTypes.FeedbackForm;
  [ONYXKEYS.FORMS.SESSION_NOTE_FORM]: FormTypes.SessionNoteForm;
};

type OnyxFormDraftValuesMapping = {
  [K in keyof OnyxFormValuesMapping as `${K}Draft`]: OnyxFormValuesMapping[K];
};

type OnyxCollectionValuesMapping = {
  [ONYXKEYS.COLLECTION.DOWNLOAD]: OnyxTypes.Download;
  [ONYXKEYS.COLLECTION.DRINKS]: OnyxTypes.Drinks;
  [ONYXKEYS.COLLECTION.DRINKING_SESSION]: OnyxTypes.DrinkingSession;
  [ONYXKEYS.COLLECTION.FEEDBACK]: OnyxTypes.Feedback;
  [ONYXKEYS.COLLECTION.BUG]: OnyxTypes.Bug;
  [ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID]: number;
  [ONYXKEYS.COLLECTION.SESSION_LOCATIONS]: OnyxTypes.SessionLocations;
};

type OnyxValuesMapping = {
  [ONYXKEYS.NVP_ONBOARDING]: OnyxTypes.OnboardingData | [];
  [ONYXKEYS.NVP_TERMS_ACCEPTED_VERSION]: number;
  [ONYXKEYS.DEVICE_ID]: string;
  [ONYXKEYS.IS_SIDEBAR_LOADED]: boolean;
  [ONYXKEYS.PERSISTED_REQUESTS]: OnyxTypes.Request[];
  [ONYXKEYS.PERSISTED_ONGOING_REQUESTS]: OnyxTypes.Request;
  [ONYXKEYS.CURRENT_DATE]: string;
  [ONYXKEYS.CREDENTIALS]: OnyxTypes.Credentials;
  [ONYXKEYS.STASHED_CREDENTIALS]: OnyxTypes.Credentials;
  [ONYXKEYS.PENDING_OAUTH_CREDENTIAL]: OnyxTypes.PendingOAuthCredential;
  [ONYXKEYS.START_SESSION_GLOBAL_CREATE]: OnyxTypes.StartSession;
  [ONYXKEYS.MODAL]: OnyxTypes.Modal;
  [ONYXKEYS.NETWORK]: OnyxTypes.Network;
  [ONYXKEYS.USER_DATA_LIST]: OnyxTypes.UserDataList;
  [ONYXKEYS.FRIENDS_METADATA]: OnyxTypes.FriendsMetadata;
  [ONYXKEYS.USER_PRIVATE_DATA]: OnyxTypes.UserPrivateData;
  [ONYXKEYS.USER_DATA_METADATA]: Record<string, OnyxTypes.UserDataMetadata>;
  [ONYXKEYS.UPDATE_AVAILABLE]: boolean;
  [ONYXKEYS.COUNTRY_CODE]: number;
  [ONYXKEYS.USER]: OnyxTypes.User;
  [ONYXKEYS.USER_LOCATION]: OnyxTypes.UserLocation;
  [ONYXKEYS.SESSION]: OnyxTypes.Session;
  [ONYXKEYS.FOCUS_MODE_NOTIFICATION]: boolean;
  [ONYXKEYS.PUSH_NOTIFICATIONS_ENABLED]: boolean;
  [ONYXKEYS.NVP_PREFERRED_LOCALE]: OnyxTypes.Locale;
  [ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE]: Record<string, DateString>;
  [ONYXKEYS.ONGOING_SESSION_DATA]: OnyxTypes.DrinkingSession;
  [ONYXKEYS.EDIT_SESSION_DATA]: OnyxTypes.DrinkingSession;
  [ONYXKEYS.IS_CREATING_NEW_SESSION]: boolean;
  [ONYXKEYS.SESSIONS_CALENDAR_MONTHS_LOADED]: number;
  [ONYXKEYS.CACHED_DRINKING_SESSIONS]: OnyxTypes.UserDrinkingSessionsList;
  [ONYXKEYS.APP_LOADING_TEXT]: string;
  [ONYXKEYS.IS_LOADING_APP]: boolean;
  [ONYXKEYS.IS_TEST_TOOLS_MODAL_OPEN]: boolean;
  [ONYXKEYS.FEATURE_ACCESS_OVERRIDES]: OnyxTypes.FeatureAccessOverrides;
  [ONYXKEYS.SHOULD_SHOW_COMPOSE_INPUT]: boolean;
  [ONYXKEYS.APP_UPDATE_DISMISSED]: Timestamp;
  [ONYXKEYS.VERIFY_EMAIL_SENT]: Timestamp;
  [ONYXKEYS.IS_BETA]: boolean;
  [ONYXKEYS.HAS_CHECKED_AUTO_LOGIN]: boolean;
  [ONYXKEYS.PREFERRED_THEME]: ValueOf<typeof CONST.THEME>;
  [ONYXKEYS.PREFERENCES]: OnyxTypes.Preferences;
  [ONYXKEYS.DATA_VISIBILITY]: OnyxTypes.DataVisibility;
  [ONYXKEYS.CONFIG]: OnyxTypes.Config;
  [ONYXKEYS.ONYX_UPDATES_FROM_SERVER]: OnyxTypes.OnyxUpdatesFromServer;
  [ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT]: number;
  [ONYXKEYS.LAST_VISITED_PATH]: string | undefined;
  [ONYXKEYS.LAST_ROUTE]: string;
  [ONYXKEYS.UPDATE_REQUIRED]: boolean;
  [ONYXKEYS.LOGS]: OnyxTypes.CapturedLogs;
  [ONYXKEYS.STATISTICS_FILTERS]: OnyxTypes.StatisticsFilters;
  [ONYXKEYS.SHOULD_STORE_LOGS]: boolean;
  [ONYXKEYS.FEEDBACK_LIST]: OnyxTypes.FeedbackList;
  [ONYXKEYS.BUG_LIST]: OnyxTypes.BugList;
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
