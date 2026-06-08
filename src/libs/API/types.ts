import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type {EmptyObject} from '@src/types/utils/EmptyObject';
import type * as Parameters from './parameters';
// import type SignInUserParams from './parameters/SignInUserParams';

type ApiRequest = ValueOf<typeof CONST.API_REQUEST_TYPE>;

const WRITE_COMMANDS = {
  UPDATE_PREFERRED_LOCALE: 'UpdatePreferredLocale',
  OPEN_APP: 'OpenApp',
  RECONNECT_APP: 'ReconnectApp',
  HANDLE_RESTRICTED_EVENT: 'HandleRestrictedEvent',
  UPDATE_PRONOUNS: 'UpdatePronouns',
  UPDATE_DISPLAY_NAME: 'UpdateDisplayName',
  SET_USERNAME: 'SetUsername',
  UPDATE_LEGAL_NAME: 'UpdateLegalName',
  UPDATE_DATE_OF_BIRTH: 'UpdateDateOfBirth',
  UPDATE_HOME_ADDRESS: 'UpdateHomeAddress',
  UPDATE_AUTOMATIC_TIMEZONE: 'UpdateAutomaticTimezone',
  UPDATE_SELECTED_TIMEZONE: 'UpdateSelectedTimezone',
  // UPDATE_USER_AVATAR: 'UpdateUserAvatar',
  DELETE_USER_AVATAR: 'DeleteUserAvatar',
  PROVISION_USER: 'ProvisionUser',
  CLOSE_ACCOUNT: 'CloseAccount',
  //   OPEN_PROFILE: 'OpenProfile',
  //   SIGN_IN_WITH_APPLE: 'SignInWithApple',
  //   SIGN_IN_WITH_GOOGLE: 'SignInWithGoogle',
  //   SIGN_IN_USER: 'SigninUser',
  //   SIGN_IN_USER_WITH_LINK: 'SigninUserWithLink',
  //   REQUEST_UNLINK_VALIDATION_LINK: 'RequestUnlinkValidationLink',
  OPT_IN_TO_PUSH_NOTIFICATIONS: 'OptInToPushNotifications',
  OPT_OUT_OF_PUSH_NOTIFICATIONS: 'OptOutOfPushNotifications',
  SEND_FRIEND_REQUEST: 'SendFriendRequest',
  ACCEPT_FRIEND_REQUEST: 'AcceptFriendRequest',
  DELETE_FRIEND_REQUEST: 'DeleteFriendRequest',
  UNFRIEND: 'Unfriend',
  UPDATE_SESSION: 'UpdateSession',
  DELETE_SESSION: 'DeleteSession',
  UPDATE_PREFERENCES: 'UpdatePreferences',
  CAPTURE_SESSION_LOCATION: 'CaptureSessionLocation',
  CLEAR_SESSION_LOCATIONS: 'ClearSessionLocations',
  PURGE_SESSION_LOCATIONS: 'PurgeSessionLocations',
  SET_HIDE_FROM_ALL_FRIENDS: 'SetHideFromAllFriends',
  SET_FRIEND_DATA_HIDDEN: 'SetFriendDataHidden',
  SUBMIT_FEEDBACK: 'SubmitFeedback',
  REPORT_BUG: 'ReportBug',
  REMOVE_FEEDBACK: 'RemoveFeedback',
  REMOVE_BUG: 'RemoveBug',
  UPDATE_PROFILE_PHOTO: 'UpdateProfilePhoto',
  SYNC_USER_STATUS: 'SyncUserStatus',
  ACCEPT_TERMS: 'AcceptTerms',
  COMPLETE_ONBOARDING: 'CompleteOnboarding',
  SET_ONBOARDING_LAST_VISITED_PATH: 'SetOnboardingLastVisitedPath',
  // ...
} as const;

type WriteCommand = ValueOf<typeof WRITE_COMMANDS>;

type WriteCommandParameters = {
  [WRITE_COMMANDS.UPDATE_PREFERRED_LOCALE]: Parameters.UpdatePreferredLocaleParams;
  [WRITE_COMMANDS.OPEN_APP]: Parameters.OpenAppParams;
  [WRITE_COMMANDS.RECONNECT_APP]: Parameters.ReconnectAppParams;
  [WRITE_COMMANDS.HANDLE_RESTRICTED_EVENT]: Parameters.HandleRestrictedEventParams;
  [WRITE_COMMANDS.UPDATE_PRONOUNS]: Parameters.UpdatePronounsParams;
  [WRITE_COMMANDS.UPDATE_DISPLAY_NAME]: Parameters.UpdateDisplayNameParams;
  [WRITE_COMMANDS.SET_USERNAME]: Parameters.SetUsernameParams;
  [WRITE_COMMANDS.UPDATE_LEGAL_NAME]: Parameters.UpdateLegalNameParams;
  [WRITE_COMMANDS.UPDATE_DATE_OF_BIRTH]: Parameters.UpdateDateOfBirthParams;
  [WRITE_COMMANDS.UPDATE_HOME_ADDRESS]: Parameters.UpdateHomeAddressParams;
  [WRITE_COMMANDS.UPDATE_AUTOMATIC_TIMEZONE]: Parameters.UpdateAutomaticTimezoneParams;
  [WRITE_COMMANDS.UPDATE_SELECTED_TIMEZONE]: Parameters.UpdateSelectedTimezoneParams;
  // [WRITE_COMMANDS.UPDATE_USER_AVATAR]: Parameters.UpdateUserAvatarParams;
  [WRITE_COMMANDS.DELETE_USER_AVATAR]: EmptyObject;
  [WRITE_COMMANDS.PROVISION_USER]: Parameters.ProvisionUserParams;
  [WRITE_COMMANDS.CLOSE_ACCOUNT]: Parameters.CloseAccountParams;
  //   [WRITE_COMMANDS.OPEN_PROFILE]: Parameters.OpenProfileParams;
  //   [WRITE_COMMANDS.SIGN_IN_WITH_APPLE]: Parameters.BeginAppleSignInParams;
  //   [WRITE_COMMANDS.SIGN_IN_WITH_GOOGLE]: Parameters.BeginGoogleSignInParams;
  //   [WRITE_COMMANDS.SIGN_IN_USER]: SignInUserParams;
  //   [WRITE_COMMANDS.SIGN_IN_USER_WITH_LINK]: Parameters.SignInUserWithLinkParams;
  //   [WRITE_COMMANDS.REQUEST_UNLINK_VALIDATION_LINK]: Parameters.RequestUnlinkValidationLinkParams;
  [WRITE_COMMANDS.OPT_IN_TO_PUSH_NOTIFICATIONS]: Parameters.OptInOutToPushNotificationsParams;
  [WRITE_COMMANDS.OPT_OUT_OF_PUSH_NOTIFICATIONS]: Parameters.OptInOutToPushNotificationsParams;
  [WRITE_COMMANDS.SEND_FRIEND_REQUEST]: Parameters.SendFriendRequestParams;
  [WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST]: Parameters.AcceptFriendRequestParams;
  [WRITE_COMMANDS.DELETE_FRIEND_REQUEST]: Parameters.DeleteFriendRequestParams;
  [WRITE_COMMANDS.UNFRIEND]: Parameters.UnfriendParams;
  [WRITE_COMMANDS.UPDATE_SESSION]: Parameters.UpdateSessionParams;
  [WRITE_COMMANDS.DELETE_SESSION]: Parameters.DeleteSessionParams;
  [WRITE_COMMANDS.UPDATE_PREFERENCES]: Parameters.UpdatePreferencesParams;
  [WRITE_COMMANDS.CAPTURE_SESSION_LOCATION]: Parameters.CaptureSessionLocationParams;
  [WRITE_COMMANDS.CLEAR_SESSION_LOCATIONS]: Parameters.ClearSessionLocationsParams;
  [WRITE_COMMANDS.PURGE_SESSION_LOCATIONS]: EmptyObject;
  [WRITE_COMMANDS.SET_HIDE_FROM_ALL_FRIENDS]: Parameters.SetHideFromAllFriendsParams;
  [WRITE_COMMANDS.SET_FRIEND_DATA_HIDDEN]: Parameters.SetFriendDataHiddenParams;
  [WRITE_COMMANDS.SUBMIT_FEEDBACK]: Parameters.SubmitFeedbackParams;
  [WRITE_COMMANDS.REPORT_BUG]: Parameters.ReportBugParams;
  [WRITE_COMMANDS.REMOVE_FEEDBACK]: Parameters.RemoveFeedbackParams;
  [WRITE_COMMANDS.REMOVE_BUG]: Parameters.RemoveBugParams;
  [WRITE_COMMANDS.UPDATE_PROFILE_PHOTO]: Parameters.UpdateProfilePhotoParams;
  [WRITE_COMMANDS.SYNC_USER_STATUS]: Parameters.SyncUserStatusParams;
  [WRITE_COMMANDS.ACCEPT_TERMS]: Parameters.AcceptTermsParams;
  [WRITE_COMMANDS.COMPLETE_ONBOARDING]: EmptyObject;
  [WRITE_COMMANDS.SET_ONBOARDING_LAST_VISITED_PATH]: Parameters.SetOnboardingLastVisitedPathParams;
};

const READ_COMMANDS = {
  //   GET_MAPBOX_ACCESS_TOKEN: 'GetMapboxAccessToken',
  //   OPEN_PAYMENTS_PAGE: 'OpenPaymentsPage',
  //   OPEN_USER_DATA: 'OpenUserDataPage',
  OPEN_PUBLIC_PROFILE_PAGE: 'OpenPublicProfilePage',
  SEARCH_USERS: 'SearchUsers',
  OPEN_FRIEND_DRINKING_SESSIONS: 'OpenFriendDrinkingSessions',
  OPEN_FRIEND_PREFERENCES: 'OpenFriendPreferences',
  OPEN_FRIEND_STATUS: 'OpenFriendStatus',
  GET_USERS_BATCH: 'GetUsersBatch',
  OPEN_FRIEND_LIST: 'OpenFriendList',
  //   OPEN_PLAID_BANK_LOGIN: 'OpenPlaidBankLogin',
  //   OPEN_PLAID_BANK_ACCOUNT_SELECTOR: 'OpenPlaidBankAccountSelector',
  //   GET_ROUTE: 'GetRoute',
  //   GET_ROUTE_FOR_DRAFT: 'GetRouteForDraft',
  //   SIGN_IN_WITH_SHORT_LIVED_AUTH_TOKEN: 'SignInWithShortLivedAuthToken',
  //   SIGN_IN_WITH_SUPPORT_AUTH_TOKEN: 'SignInWithSupportAuthToken',
  //   OPEN_WORKSPACE_REIMBURSE_VIEW: 'OpenWorkspaceReimburseView',
  // ...
} as const;

type ReadCommand = ValueOf<typeof READ_COMMANDS>;

type ReadCommandParameters = {
  //   [READ_COMMANDS.OPEN_WORKSPACE_VIEW]: Parameters.OpenWorkspaceViewParams;
  //   [READ_COMMANDS.GET_MAPBOX_ACCESS_TOKEN]: EmptyObject;
  //   [READ_COMMANDS.OPEN_PAYMENTS_PAGE]: EmptyObject;
  //   [READ_COMMANDS.OPEN_USER_DATA]: EmptyObject;
  [READ_COMMANDS.OPEN_PUBLIC_PROFILE_PAGE]: Parameters.OpenPublicProfilePageParams;
  [READ_COMMANDS.SEARCH_USERS]: Parameters.SearchUsersParams;
  [READ_COMMANDS.OPEN_FRIEND_DRINKING_SESSIONS]: Parameters.OpenFriendDrinkingSessionsParams;
  [READ_COMMANDS.OPEN_FRIEND_PREFERENCES]: Parameters.OpenFriendPreferencesParams;
  [READ_COMMANDS.OPEN_FRIEND_STATUS]: Parameters.OpenFriendStatusParams;
  [READ_COMMANDS.GET_USERS_BATCH]: Parameters.GetUsersBatchParams;
  [READ_COMMANDS.OPEN_FRIEND_LIST]: Parameters.OpenFriendListParams;
  //    ...
};

const SIDE_EFFECT_REQUEST_COMMANDS = {
  //   AUTHENTICATE_PUSHER: 'AuthenticatePusher',
  //   OPEN_REPORT: 'OpenReport',
  //   OPEN_OLD_DOT_LINK: 'OpenOldDotLink',
  //   REVEAL_EXPENSIFY_CARD_DETAILS: 'RevealExpensifyCardDetails',
  GET_MISSING_ONYX_MESSAGES: 'GetMissingOnyxMessages',
  //   JOIN_POLICY_VIA_INVITE_LINK: 'JoinWorkspaceViaInviteLink',
  RECONNECT_APP: 'ReconnectApp',
  GET_FEEDBACK_LIST: 'GetFeedbackList',
  GET_BUG_LIST: 'GetBugList',
  GET_MIN_VERSION: 'GetMinVersion',
} as const;

type SideEffectRequestCommand = ValueOf<typeof SIDE_EFFECT_REQUEST_COMMANDS>;

type SideEffectRequestCommandParameters = {
  //   [SIDE_EFFECT_REQUEST_COMMANDS.AUTHENTICATE_PUSHER]: Parameters.AuthenticatePusherParams;
  //   [SIDE_EFFECT_REQUEST_COMMANDS.OPEN_REPORT]: Parameters.OpenReportParams;
  // [SIDE_EFFECT_REQUEST_COMMANDS.OPEN_OLD_DOT_LINK]: Parameters.OpenOldDotLinkParams;
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_MISSING_ONYX_MESSAGES]: Parameters.GetMissingOnyxMessagesParams;
  [SIDE_EFFECT_REQUEST_COMMANDS.RECONNECT_APP]: Parameters.ReconnectAppParams;
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_FEEDBACK_LIST]: EmptyObject;
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_BUG_LIST]: EmptyObject;
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_MIN_VERSION]: EmptyObject;
};

type ApiRequestCommandParameters = WriteCommandParameters &
  ReadCommandParameters &
  SideEffectRequestCommandParameters;

export {WRITE_COMMANDS, READ_COMMANDS, SIDE_EFFECT_REQUEST_COMMANDS};

export type {
  ApiRequest,
  ApiRequestCommandParameters,
  WriteCommand,
  ReadCommand,
  SideEffectRequestCommand,
};
