import ERRORS from '@src/ERRORS';
import type {ErrorMapping} from './types';

/**
 * A mapping of known error keys to short titles and descriptive messages.
 * Update or extend this mapping as needed.
 *
 * If ever more data has to be kept about each error, the values here can be extended into a full-fledged object.
 */
const ERROR_MAPPING: ErrorMapping = {
  [ERRORS.STORAGE.OBJECT_NOT_FOUND]: 'errors.storage.objectNotFound',
  [ERRORS.STORAGE.UNAUTHORIZED]: 'errors.storage.unauthorized',
  [ERRORS.AUTH.ACCOUNT_DELETION_FAILED]: 'errors.auth.accountDeletionFailed',
  [ERRORS.AUTH.MISSING_EMAIL]: 'errors.auth.missingEmail',
  [ERRORS.AUTH.INVALID_EMAIL]: 'errors.auth.invalidEmail',
  [ERRORS.AUTH.VERIFY_EMAIL]: 'errors.auth.verifyEmail',
  [ERRORS.AUTH.MISSING_PASSWORD]: 'errors.auth.missingPassword',
  [ERRORS.AUTH.INVALID_CREDENTIAL]: 'errors.auth.invalidCredential',
  [ERRORS.AUTH.WEAK_PASSWORD]: 'errors.auth.weakPassword',
  [ERRORS.AUTH.EMAIL_ALREADY_IN_USE]: 'errors.auth.emailAlreadyInUse',
  [ERRORS.AUTH.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL]:
    'errors.auth.accountExistsWithDifferentCredential',
  [ERRORS.AUTH.USER_NOT_FOUND]: 'errors.auth.userNotFound',
  [ERRORS.AUTH.WRONG_PASSWORD]: 'errors.auth.wrongPassword',
  [ERRORS.AUTH.NETWORK_REQUEST_FAILED]: 'errors.auth.networkRequestFailed',
  [ERRORS.AUTH.REQUIRES_RECENT_LOGIN]: 'errors.auth.requiresRecentLogin',
  [ERRORS.AUTH.API_KEY_NOT_VALID]: 'errors.auth.apiKeyNotValid',
  [ERRORS.AUTH.TOO_MANY_REQUESTS]: 'errors.auth.tooManyRequests',
  [ERRORS.AUTH.SIGN_OUT_FAILED]: 'errors.auth.signOutFailed',
  [ERRORS.AUTH.USER_IS_NULL]: 'errors.auth.userIsNull',
  [ERRORS.DATABASE.ACCOUNT_CREATION_LIMIT_EXCEEDED]:
    'errors.database.accountCreationLimitExceeded',
  [ERRORS.DATABASE.DATA_FETCH_FAILED]: 'errors.database.dataFetchFailed',
  [ERRORS.DATABASE.OUTDATED_APP_VERSION]: 'errors.database.outdatedAppVersion',
  [ERRORS.DATABASE.SEARCH_FAILED]: 'errors.database.searchFailed',
  [ERRORS.DATABASE.USER_CREATION_FAILED]: 'errors.database.userCreationFailed',
  [ERRORS.HOME_SCREEN.TITLE]: 'errors.homeScreen.title',
  [ERRORS.HOME_SCREEN.NO_LIVE_SESSION]: 'errors.homeScreen.noLiveSession',
  [ERRORS.IMAGE_UPLOAD.FETCH_FAILED]: 'errors.imageUpload.fetchFailed',
  [ERRORS.IMAGE_UPLOAD.UPLOAD_FAILED]: 'errors.imageUpload.uploadFailed',
  [ERRORS.IMAGE_UPLOAD.CHOICE_FAILED]: 'errors.imageUpload.choiceFailed',
  [ERRORS.ONYX.GENERIC]: 'errors.onyx.generic',
  [ERRORS.SESSION.DISCARD_FAILED]: 'errors.session.discardFailed',
  [ERRORS.SESSION.LOAD_FAILED]: 'errors.session.loadFailed',
  [ERRORS.SESSION.SAVE_FAILED]: 'errors.session.saveFailed',
  [ERRORS.SESSION.START_FAILED]: 'errors.session.startFailed',
  [ERRORS.USER.BUG_SUBMISSION_FAILED]: 'errors.user.bugSubmissionFailed',
  [ERRORS.USER.COULD_NOT_UNFRIEND]: 'errors.user.couldNotUnfriend',
  [ERRORS.USER.DATA_FETCH_FAILED]: 'errors.user.dataFetchFailed',
  [ERRORS.USER.FEEDBACK_REMOVAL_FAILED]: 'errors.user.feedbackRemovalFailed',
  [ERRORS.USER.FEEDBACK_SUBMISSION_FAILED]:
    'errors.user.feedbackSubmissionFailed',
  [ERRORS.USER.FRIEND_REQUEST_SEND_FAILED]:
    'errors.user.friendRequestSendFailed',
  [ERRORS.USER.FRIEND_REQUEST_ACCEPT_FAILED]:
    'errors.user.friendRequestAcceptFailed',
  [ERRORS.USER.FRIEND_REQUEST_REJECT_FAILED]:
    'errors.user.friendRequestRejectFailed',
  [ERRORS.USER.NICKNAME_UPDATE_FAILED]: 'errors.user.nicknameUpdateFailed',
  [ERRORS.USER.STATUS_UPDATE_FAILED]: 'errors.user.statusUpdateFailed',
  [ERRORS.USER.THEME_UPDATE_FAILED]: 'errors.user.themeUpdateFailed',
  [ERRORS.USER.TIMEZONE_UPDATE_FAILED]: 'errors.user.timezoneUpdateFailed',
  [ERRORS.USER.USERNAME_UPDATE_FAILED]: 'errors.user.usernameUpdateFailed',
  [ERRORS.GENERIC]: 'errors.generic',
  [ERRORS.PERMISSION_DENIED]: 'errors.permissionDenied',
  [ERRORS.UNKNOWN]: 'errors.unknown',
};

export default ERROR_MAPPING;
