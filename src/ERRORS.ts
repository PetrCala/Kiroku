import type DeepValueOf from './types/utils/DeepValueOf';

/**
 * A centralized object defining all known error keys used in the application.
 * This object categorizes errors based on their domain (e.g., STORAGE, AUTH, DATABASE)
 * and provides a consistent reference for error handling throughout the codebase.
 *
 * Usage:
 * - Use these constants in the application to avoid hardcoding error keys.
 * - Update or extend this object as new error categories or keys are introduced.
 */
const ERRORS = {
  STORAGE: {
    OBJECT_NOT_FOUND: 'storage/object-not-found',
    UNAUTHORIZED: 'storage/unauthorized',
  },
  AUTH: {
    ACCOUNT_CREATION_LIMIT_EXCEEDED: 'auth/account-creation-limit-exceeded',
    ACCOUNT_DELETION_FAILED: 'user/account-deletion-failed',
    MISSING_EMAIL: 'auth/missing-email',
    INVALID_EMAIL: 'auth/invalid-email',
    VERIFY_EMAIL: 'auth/verify-email',
    MISSING_PASSWORD: 'auth/missing-password',
    INVALID_CREDENTIAL: 'auth/invalid-credential',
    WEAK_PASSWORD: 'auth/weak-password',
    EMAIL_ALREADY_IN_USE: 'auth/email-already-in-use',
    ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
      'auth/account-exists-with-different-credential',
    USER_NOT_FOUND: 'auth/user-not-found',
    WRONG_PASSWORD: 'auth/wrong-password',
    NETWORK_REQUEST_FAILED: 'auth/network-request-failed',
    REQUIRES_RECENT_LOGIN: 'auth/requires-recent-login',
    API_KEY_NOT_VALID: 'auth/api-key-not-valid',
    TOO_MANY_REQUESTS: 'auth/too-many-requests',
    SIGN_OUT_FAILED: 'auth/sign-out-failed',
    USER_IS_NULL: 'auth/user-is-null',
    CREDENTIAL_ALREADY_IN_USE: 'auth/credential-already-in-use',
    NO_SUCH_PROVIDER: 'auth/no-such-provider',
    LAST_PROVIDER: 'auth/last-provider',
  },
  DATABASE: {
    DATA_FETCH_FAILED: 'database/data-fetch-failed',
    OUTDATED_APP_VERSION: 'database/outdated-app-version',
    SEARCH_FAILED: 'database/search-failed',
    USER_CREATION_FAILED: 'database/user-creation-failed',
  },
  HOME_SCREEN: {
    TITLE: 'home-screen/title',
    NO_LIVE_SESSION: 'home-screen/no-live-session',
  },
  IMAGE_UPLOAD: {
    FETCH_FAILED: 'image-upload/fetch-failed',
    UPLOAD_FAILED: 'image-upload/upload-failed',
    CHOICE_FAILED: 'image-upload/choice-failed',
  },
  ONYX: {
    GENERIC: 'onyx/generic',
  },
  SESSION: {
    DISCARD_FAILED: 'session/discard-failed',
    LOAD_FAILED: 'session/load-failed',
    SAVE_FAILED: 'session/save-failed',
    START_FAILED: 'session/start-failed',
  },
  USER: {
    BUG_SUBMISSION_FAILED: 'user/bug-submission-failed',
    COULD_NOT_UNFRIEND: 'user/could-not-unfriend',
    DATA_FETCH_FAILED: 'user/data-fetch-failed',
    FEEDBACK_REMOVAL_FAILED: 'user/feedback-removal-failed',
    FEEDBACK_SUBMISSION_FAILED: 'user/feedback-submission-failed',
    FRIEND_REQUEST_SEND_FAILED: 'user/friend-request-send-failed',
    FRIEND_REQUEST_ACCEPT_FAILED: 'user/friend-request-accept-failed',
    FRIEND_REQUEST_REJECT_FAILED: 'user/friend-request-reject-failed',
    NICKNAME_UPDATE_FAILED: 'user/nickname-update-failed',
    STATUS_UPDATE_FAILED: 'user/status-update-failed',
    THEME_UPDATE_FAILED: 'user/theme-update-failed',
    TIMEZONE_UPDATE_FAILED: 'user/timezone-update-failed',
    USERNAME_UPDATE_FAILED: 'user/username-update-failed',
  },
  GENERIC: 'error/generic',
  PERMISSION_DENIED: 'error/PERMISSION_DENIED: Permission denied',
  UNKNOWN: 'error/unknown',
} as const;

type ErrorKey = DeepValueOf<typeof ERRORS>;

export default ERRORS;
export type {ErrorKey};
