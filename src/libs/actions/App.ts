// Issue - https://github.com/Expensify/App/issues/26719
import type {AppStateStatus} from 'react-native';
import {AppState} from 'react-native';
import type {
  OnyxEntry,
  OnyxKey,
  OnyxMergeInput,
  OnyxUpdate,
} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import * as API from '@libs/API';
import type {
  GetMissingOnyxMessagesParams,
  HandleRestrictedEventParams,
  OpenAppParams,
  //   OpenOldDotLinkParams,
  //   // OpenProfileParams,
  ReconnectAppParams,
  UpdatePreferredLocaleParams,
} from '@libs/API/parameters';
import {SIDE_EFFECT_REQUEST_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
// import * as Browser from '@libs/Browser';
// import DateUtils from '@libs/DateUtils';
// import Log from '@libs/Log';
import getCurrentUrl from '@libs/Navigation/currentUrl';
import Navigation from '@libs/Navigation/Navigation';
// import Performance from '@libs/Performance';
// import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import type CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
// import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {OnyxData} from '@src/types/onyx/Request';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {User} from 'firebase/auth';
import {resolveDuplicationConflictAction} from './RequestConflictUtils';
// import * as Session from './Session';
// import Timing from './Timing';

type Locale = ValueOf<typeof CONST.LOCALES>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentUserEmail: string;
let currentUserID: UserID | undefined;
Onyx.connect({
  key: ONYXKEYS.SESSION,
  callback: val => {
    currentUserEmail = val?.email ?? '';
    currentUserID = val?.userID ?? undefined;
  },
});

let isSidebarLoaded: boolean | undefined;
Onyx.connect({
  key: ONYXKEYS.IS_SIDEBAR_LOADED,
  callback: val => (isSidebarLoaded = val),
  initWithStoredValues: false,
});

let preferredLocale: string | undefined;
Onyx.connect({
  key: ONYXKEYS.NVP_PREFERRED_LOCALE,
  callback: val => (preferredLocale = val),
});

const KEYS_TO_PRESERVE: OnyxKey[] = [
  // ONYXKEYS.ACCOUNT,
  ONYXKEYS.IS_LOADING_APP,
  ONYXKEYS.IS_SIDEBAR_LOADED,
  ONYXKEYS.MODAL,
  ONYXKEYS.NETWORK,
  ONYXKEYS.SESSION,
  ONYXKEYS.SHOULD_SHOW_COMPOSE_INPUT,
  ONYXKEYS.PREFERRED_THEME,
  ONYXKEYS.NVP_PREFERRED_LOCALE,
  ONYXKEYS.CREDENTIALS,
];

let resolveIsReadyPromise: () => void;
const isReadyToOpenApp = new Promise<void>(resolve => {
  resolveIsReadyPromise = resolve;
});

function confirmReadyToOpenApp() {
  resolveIsReadyPromise();
}

function setLocale(locale: Locale) {
  if (locale === preferredLocale) {
    return;
  }

  // If user is not signed in, change just locally.
  if (!currentUserID) {
    Onyx.merge(ONYXKEYS.NVP_PREFERRED_LOCALE, locale);
    return;
  }

  // Optimistically change preferred locale
  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.NVP_PREFERRED_LOCALE,
      value: locale,
    },
  ];

  const parameters: UpdatePreferredLocaleParams = {
    value: locale,
  };

  API.write(WRITE_COMMANDS.UPDATE_PREFERRED_LOCALE, parameters, {
    optimisticData,
  });
}

function setLocaleAndNavigate(locale: Locale) {
  setLocale(locale);
  Navigation.goBack();
}

function setSidebarLoaded() {
  if (isSidebarLoaded) {
    return;
  }

  Onyx.set(ONYXKEYS.IS_SIDEBAR_LOADED, true);
  // Performance.markStart(CONST.TIMING.REPORT_INITIAL_RENDER);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let appState: AppStateStatus;
AppState.addEventListener('change', nextAppState => {
  // if (nextAppState.match(/inactive|background/) && appState === 'active') {
  //   Log.info('Flushing logs as app is going inactive', true, {}, true);
  // }
  appState = nextAppState;
});

/**
 * Returns the Onyx data that is used for both the OpenApp and ReconnectApp API commands.
 */
function getOnyxDataForOpenOrReconnect(isOpenApp = false): OnyxData {
  const defaultData = {
    optimisticData: [],
    finallyData: [],
    // Possibly add data for sessions
    //   {
    //     onyxMethod: Onyx.METHOD.MERGE,
    //     key: ONYXKEYS.IS_LOADING_SESSION_DATA,
    //     value: true,
    //   },
    // ],
    // finallyData: [
    //   {
    //     onyxMethod: Onyx.METHOD.MERGE,
    //     key: ONYXKEYS.IS_LOADING_SESSION_DATA,
    //     value: false,
    //   },
    // ],
  };
  if (!isOpenApp) {
    return defaultData;
  }
  return {
    optimisticData: [
      ...defaultData.optimisticData,
      {
        onyxMethod: Onyx.METHOD.MERGE,
        key: ONYXKEYS.IS_LOADING_APP,
        value: true,
      },
    ],
    finallyData: [
      ...defaultData.finallyData,
      {
        onyxMethod: Onyx.METHOD.MERGE,
        key: ONYXKEYS.IS_LOADING_APP,
        value: false,
      },
    ],
  };
}

/**
 * Fetches data needed for app initialization
 */
function openApp() {
  // getPolicyParamsForOpenOrReconnect().then(
  // (policyParams: PolicyParamsForOpenOrReconnect) => {
  const params: OpenAppParams = {
    enablePriorityModeFilter: true,
    // ...policyParams,
  };
  API.write(
    WRITE_COMMANDS.OPEN_APP,
    params,
    getOnyxDataForOpenOrReconnect(true),
  );
  // },
  // );
}

/**
 * Fetches data when the app reconnects to the network
 * @param [updateIDFrom] the ID of the Onyx update that we want to start fetching from
 */
function reconnectApp(updateIDFrom: OnyxEntry<number> = 0) {
  console.debug(
    `[OnyxUpdates] App reconnecting with updateIDFrom: ${updateIDFrom}`,
  );
  // getPolicyParamsForOpenOrReconnect().then(policyParams => {
  //   const params: ReconnectAppParams = policyParams;
  const params: ReconnectAppParams = {};

  //   // When the app reconnects we do a fast "sync" of the LHN and only return chats that have new messages. We achieve this by sending the most recent reportActionID.
  //   // we have locally. And then only update the user about chats with messages that have occurred after that reportActionID.
  //   //
  //   // - Look through the local report actions and reports to find the most recently modified report action or report.
  //   // - We send this to the server so that it can compute which new chats the user needs to see and return only those as an optimization.
  //   Timing.start(CONST.TIMING.CALCULATE_MOST_RECENT_LAST_MODIFIED_ACTION);
  //   params.mostRecentReportActionLastModified =
  //     ReportActionsUtils.getMostRecentReportActionLastModified();
  //   Timing.end(
  //     CONST.TIMING.CALCULATE_MOST_RECENT_LAST_MODIFIED_ACTION,
  //     '',
  //     500,
  //   );

  // Include the update IDs when reconnecting so that the server can send incremental updates if they are available.
  // Otherwise, a full set of app data will be returned.
  if (updateIDFrom) {
    params.updateIDFrom = updateIDFrom;
  }

  API.write(
    WRITE_COMMANDS.RECONNECT_APP,
    params,
    getOnyxDataForOpenOrReconnect(),
    {
      checkAndFixConflictingRequest: persistedRequests =>
        resolveDuplicationConflictAction(
          persistedRequests,
          request => request.command === WRITE_COMMANDS.RECONNECT_APP,
        ),
    },
  );
  // });
}

/**
 * Fetches data when the app will call reconnectApp without params for the last time. This is a separate function
 * because it will follow patterns that are not recommended so we can be sure we're not putting the app in a unusable
 * state because of race conditions between reconnectApp and other pusher updates being applied at the same time.
 */
function finalReconnectAppAfterActivatingReliableUpdates(): Promise<void | OnyxTypes.Response> {
  console.debug(`[OnyxUpdates] Executing last reconnect app with promise`);

  // return getPolicyParamsForOpenOrReconnect().then(policyParams => {
  // const params: ReconnectAppParams = {...policyParams};
  const params: ReconnectAppParams = {};

  // When the app reconnects we do a fast "sync" of the LHN and only return chats that have new messages. We achieve this by sending the most recent reportActionID.
  // we have locally. And then only update the user about chats with messages that have occurred after that reportActionID.
  //
  // - Look through the local report actions and reports to find the most recently modified report action or report.
  // - We send this to the server so that it can compute which new chats the user needs to see and return only those as an optimization.
  // Timing.start(CONST.TIMING.CALCULATE_MOST_RECENT_LAST_MODIFIED_ACTION);
  // params.mostRecentReportActionLastModified =
  //   ReportActionsUtils.getMostRecentReportActionLastModified();
  // Timing.end(
  //   CONST.TIMING.CALCULATE_MOST_RECENT_LAST_MODIFIED_ACTION,
  //   '',
  //   500,
  // );

  // It is SUPER BAD FORM to return promises from action methods.
  // DO NOT FOLLOW THIS PATTERN!!!!!
  // It was absolutely necessary in order to not break the app while migrating to the new reliable updates pattern. This method will be removed
  // as soon as we have everyone migrated to the reliableUpdate beta.
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.RECONNECT_APP,
    params,
    getOnyxDataForOpenOrReconnect(),
  );
  // });
}

/**
 * Fetches data when the client has discovered it missed some Onyx updates from the server
 * @param [updateIDFrom] the ID of the Onyx update that we want to start fetching from
 * @param [updateIDTo] the ID of the Onyx update that we want to fetch up to
 */
function getMissingOnyxUpdates(
  updateIDFrom = 0,
  updateIDTo: number | string = 0,
): Promise<void | OnyxTypes.Response> {
  console.debug(
    `[OnyxUpdates] Fetching missing updates updateIDFrom: ${updateIDFrom} and updateIDTo: ${updateIDTo}`,
  );

  const parameters: GetMissingOnyxMessagesParams = {
    updateIDFrom,
    updateIDTo,
  };

  // It is SUPER BAD FORM to return promises from action methods.
  // DO NOT FOLLOW THIS PATTERN!!!!!
  // It was absolutely necessary in order to block OnyxUpdates while fetching the missing updates from the server or else the udpates aren't applied in the proper order.
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.GET_MISSING_ONYX_MESSAGES,
    parameters,
    getOnyxDataForOpenOrReconnect(),
  );
}

/**
 * This promise is used so that deeplink component know when a transition is end.
 * This is necessary because we want to begin deeplink redirection after the transition is end.
 */
let resolveSignOnTransitionToFinishPromise: () => void;
const signOnTransitionToFinishPromise = new Promise<void>(resolve => {
  resolveSignOnTransitionToFinishPromise = resolve;
});

function waitForSignOnTransitionToFinish(): Promise<void> {
  return signOnTransitionToFinishPromise;
}

function endSignOnTransition() {
  return resolveSignOnTransitionToFinishPromise();
}

// /**
//  * Create a new draft workspace and navigate to it
//  *
//  * @param [policyOwnerEmail] Optional, the email of the account to make the owner of the policy
//  * @param [policyName] Optional, custom policy name we will use for created workspace
//  * @param [transitionFromOldDot] Optional, if the user is transitioning from old dot
//  * @param [makeMeAdmin] Optional, leave the calling account as an admin on the policy
//  */
// function createWorkspaceWithPolicyDraftAndNavigateToIt(
//   policyOwnerEmail = '',
//   policyName = '',
//   transitionFromOldDot = false,
//   makeMeAdmin = false,
// ) {
//   const policyID = Policy.generatePolicyID();
//   Policy.createDraftInitialWorkspace(
//     policyOwnerEmail,
//     policyName,
//     policyID,
//     makeMeAdmin,
//   );

//   Navigation.isNavigationReady()
//     .then(() => {
//       if (transitionFromOldDot) {
//         // We must call goBack() to remove the /transition route from history
//         Navigation.goBack();
//       }
//       Navigation.navigate(ROUTES.WORKSPACE_INITIAL.getRoute(policyID));
//     })
//     .then(endSignOnTransition);
// }

/**
 * Create a new workspace and delete the draft
 *
 * @param [policyID] the ID of the policy to use
 * @param [policyName] custom policy name we will use for created workspace
 * @param [policyOwnerEmail] Optional, the email of the account to make the owner of the policy
 * @param [makeMeAdmin] Optional, leave the calling account as an admin on the policy
 */
// function savePolicyDraftByNewWorkspace(
//   policyID?: string,
//   policyName?: string,
//   policyOwnerEmail = '',
//   makeMeAdmin = false,
// ) {
//   Policy.createWorkspace(policyOwnerEmail, makeMeAdmin, policyName, policyID);
// }

/**
 * This action runs when the Navigator is ready and the current route changes
 *
 * currentPath should be the path as reported by the NavigationContainer
 *
 * The transition link contains an exitTo param that contains the route to
 * navigate to after the user is signed in. A user can transition from OldDot
 * with a different account than the one they are currently signed in with, so
 * we only navigate if they are not signing in as a new user. Once they are
 * signed in as that new user, this action will run again and the navigation
 * will occur.

 * When the exitTo route is 'workspace/new', we create a new
 * workspace and navigate to it
 *
 * We subscribe to the session using withOnyx in the AuthScreens and
 * pass it in as a parameter. withOnyx guarantees that the value has been read
 * from Onyx because it will not render the AuthScreens until that point.
 */
function setUpPoliciesAndNavigate(user: User | null) {
  const currentUrl = getCurrentUrl();
  if (!user || !currentUrl?.includes('exitTo')) {
    return;
  }

  const isLoggingInAsNewUser = !!user.email; // && SessionUtils.isLoggingInAsNewUser(currentUrl, user.email);
  const url = new URL(currentUrl);
  const exitTo = url.searchParams.get('exitTo') as Route | null;

  // Approved Accountants and Guides can enter a flow where they make a workspace for other users,
  // and those are passed as a search parameter when using transition links
  // const policyOwnerEmail = url.searchParams.get('ownerEmail') ?? '';
  // const makeMeAdmin = !!url.searchParams.get('makeMeAdmin');
  // const policyName = url.searchParams.get('policyName') ?? '';

  // Sign out the current user if we're transitioning with a different user
  // const isTransitioning = Str.startsWith(
  //   url.pathname,
  //   Str.normalizeUrl(ROUTES.TRANSITION_BETWEEN_APPS),
  // );

  // const shouldCreateFreePolicy =
  // !isLoggingInAsNewUser && isTransitioning && exitTo === ROUTES.WORKSPACE_NEW;
  // if (shouldCreateFreePolicy) {
  //   createWorkspaceWithPolicyDraftAndNavigateToIt(
  //     policyOwnerEmail,
  //     policyName,
  //     true,
  //     makeMeAdmin,
  //   );
  //   return;
  // }
  if (!isLoggingInAsNewUser && exitTo) {
    Navigation.waitForProtectedRoutes()
      .then(() => {
        // We must call goBack() to remove the /transition route from history
        Navigation.goBack();
        Navigation.navigate(exitTo);
      })
      .then(endSignOnTransition);
  }
}

function redirectThirdPartyDesktopSignIn() {
  const currentUrl = getCurrentUrl();
  if (!currentUrl) {
    return;
  }
  const url = new URL(currentUrl);

  if (
    url.pathname === `/${ROUTES.GOOGLE_SIGN_IN}` ||
    url.pathname === `/${ROUTES.APPLE_SIGN_IN}`
  ) {
    Navigation.isNavigationReady().then(() => {
      Navigation.goBack();
      Navigation.navigate(ROUTES.DESKTOP_SIGN_IN_REDIRECT);
    });
  }
}

// function openProfile(personalDetails: OnyxTypes.UserData) {
//   const oldTimezoneData = personalDetails.timezone ?? {};
//   let newTimezoneData = oldTimezoneData;

//   if (oldTimezoneData?.automatic ?? true) {
//     newTimezoneData = {
//       automatic: true,
//       selected: Intl.DateTimeFormat().resolvedOptions()
//         .timeZone as SelectedTimezone,
//     };
//   }

//   newTimezoneData = DateUtils.formatToSupportedTimezone(newTimezoneData);

//   const parameters: OpenProfileParams = {
//     timezone: JSON.stringify(newTimezoneData),
//   };

//   // We expect currentUserID to be a number because it doesn't make sense to open profile if currentUserID is not set
//   if (typeof currentUserID === 'number') {
//     API.write(WRITE_COMMANDS.OPEN_PROFILE, parameters, {
//       optimisticData: [
//         {
//           onyxMethod: Onyx.METHOD.MERGE,
//           key: ONYXKEYS.USER_DATA_LIST,
//           value: {
//             [currentUserID]: {
//               timezone: newTimezoneData,
//             },
//           },
//         },
//       ],
//       failureData: [
//         {
//           onyxMethod: Onyx.METHOD.MERGE,
//           key: ONYXKEYS.USER_DATA_LIST,
//           value: {
//             [currentUserID]: {
//               timezone: oldTimezoneData,
//             },
//           },
//         },
//       ],
//     });
//   }
// }

// /**
//  * @param shouldAuthenticateWithCurrentAccount Optional, indicates whether default authentication method (shortLivedAuthToken) should be used
//  */
// function beginDeepLinkRedirect(shouldAuthenticateWithCurrentAccount = true) {
//   // There's no support for anonymous users on desktop
//   if (Session.isAnonymousUser()) {
//     return;
//   }

//   // If the route that is being handled is a magic link, email and shortLivedAuthToken should not be attached to the url
//   // to prevent signing into the wrong account
//   if (!currentUserID || !shouldAuthenticateWithCurrentAccount) {
//     Browser.openRouteInDesktopApp();
//     return;
//   }

//   const parameters: OpenOldDotLinkParams = {shouldRetry: false};

//   // eslint-disable-next-line rulesdir/no-api-side-effects-method
//   API.makeRequestWithSideEffects(
//     SIDE_EFFECT_REQUEST_COMMANDS.OPEN_OLD_DOT_LINK,
//     parameters,
//     {},
//   ).then(response => {
//     if (!response) {
//       Log.alert(
//         'Trying to redirect via deep link, but the response is empty. User likely not authenticated.',
//         {response, shouldAuthenticateWithCurrentAccount, currentUserID},
//         true,
//       );
//       return;
//     }

//     Browser.openRouteInDesktopApp(
//       response.shortLivedAuthToken,
//       currentUserEmail,
//     );
//   });
// }

// /**
//  * @param shouldAuthenticateWithCurrentAccount Optional, indicates whether default authentication method (shortLivedAuthToken) should be used
//  */
// function beginDeepLinkRedirectAfterTransition(
//   shouldAuthenticateWithCurrentAccount = true,
// ) {
//   waitForSignOnTransitionToFinish().then(() =>
//     beginDeepLinkRedirect(shouldAuthenticateWithCurrentAccount),
//   );
// }

function handleRestrictedEvent(eventName: string) {
  const parameters: HandleRestrictedEventParams = {eventName};

  API.write(WRITE_COMMANDS.HANDLE_RESTRICTED_EVENT, parameters);
}

function updateLastVisitedPath(path: string) {
  Onyx.merge(ONYXKEYS.LAST_VISITED_PATH, path);
}

function updateLastRoute(screen: string) {
  Onyx.set(ONYXKEYS.LAST_ROUTE, screen);
}

async function setLoadingText(
  text: OnyxMergeInput<'appLoadingText'>,
): Promise<void> {
  await Onyx.merge(ONYXKEYS.APP_LOADING_TEXT, text);
}

export {
  setLoadingText,
  setLocale,
  setLocaleAndNavigate,
  setSidebarLoaded,
  setUpPoliciesAndNavigate,
  // openProfile,
  redirectThirdPartyDesktopSignIn,
  isReadyToOpenApp,
  openApp,
  reconnectApp,
  confirmReadyToOpenApp,
  handleRestrictedEvent,
  // beginDeepLinkRedirect,
  // beginDeepLinkRedirectAfterTransition,
  getMissingOnyxUpdates,
  finalReconnectAppAfterActivatingReliableUpdates,
  // savePolicyDraftByNewWorkspace,
  // createWorkspaceWithPolicyDraftAndNavigateToIt,
  updateLastVisitedPath,
  updateLastRoute,
  waitForSignOnTransitionToFinish,
  KEYS_TO_PRESERVE,
};
