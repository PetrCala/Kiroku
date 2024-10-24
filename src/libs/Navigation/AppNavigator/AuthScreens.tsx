import React, {memo, useEffect, useMemo, useRef} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import Onyx, {withOnyx} from 'react-native-onyx';
// import OptionsListContextProvider from '@components/OptionListContextProvider';
// import useOnboardingLayout from '@hooks/useOnboardingLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import KeyboardShortcut from '@libs/KeyboardShortcut';
import Log from '@libs/Log';
import getCurrentUrl from '@libs/Navigation/currentUrl';
import Navigation from '@libs/Navigation/Navigation';
import type {AuthScreensParamList} from '@libs/Navigation/types';
import NetworkConnection from '@libs/NetworkConnection';
import * as Pusher from '@libs/Pusher/pusher';
// import PusherConnectionManager from '@libs/PusherConnectionManager';
import getTzFixModalScreenOptions from '@libs/Navigation/getTzFixModalScreenOptions';
import * as SessionUtils from '@libs/SessionUtils';
// import NotFoundPage from '@pages/ErrorPage/NotFoundPage';
import NotFoundScreen from '@screens/ErrorScreen/NotFoundScreen';
// import DesktopSignInRedirectPage from '@pages/signin/DesktopSignInRedirectPage';
import * as App from '@userActions/App';
// import * as Download from '@userActions/Download';
import * as Modal from '@userActions/Modal';
import * as PersonalDetails from '@userActions/PersonalDetails';
// import * as PriorityMode from '@userActions/PriorityMode';
import * as Session from '@userActions/Session';
import Timing from '@userActions/Timing';
// import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import {DatabaseDataProvider} from '@context/global/DatabaseDataContext';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/PersonalDetails';
import createCustomStackNavigator from './createCustomStackNavigator';
import defaultScreenOptions from './defaultScreenOptions';
import getRootNavigatorScreenOptions from './getRootNavigatorScreenOptions';
import BottomTabNavigator from './Navigators/BottomTabNavigator';
// import CentralPaneNavigator from './Navigators/CentralPaneNavigator';
// import FullScreenNavigator from './Navigators/FullScreenNavigator';
// import LeftModalNavigator from './Navigators/LeftModalNavigator';
// import OnboardingModalNavigator from './Navigators/OnboardingModalNavigator';
import TzFixModalNavigator from './Navigators/TzFixModalNavigator';
import RightModalNavigator from './Navigators/RightModalNavigator';
// import WelcomeVideoModalNavigator from './Navigators/WelcomeVideoModalNavigator';

type AuthScreensProps = {
  /** Session of currently logged in user */
  session: OnyxEntry<OnyxTypes.Session>;

  /** The last Onyx update ID was applied to the client */
  initialLastUpdateIDAppliedToClient: OnyxEntry<number>;
};

let timezone: Timezone | null;
let currentUserID = '-1';
let isLoadingApp = false;
let lastUpdateIDAppliedToClient: OnyxEntry<number>;

Onyx.connect({
  key: ONYXKEYS.SESSION,
  callback: value => {
    // When signed out, val hasn't userID
    if (!(value && 'userID' in value)) {
      timezone = null;
      return;
    }

    currentUserID = value.userID ?? '-1';

    // TODO
    // if (Navigation.isActiveRoute(ROUTES.SIGN_IN_MODAL)) {
    //   // This means sign in in RHP was successful, so we can subscribe to user events
    //   User.subscribeToUserEvents();
    // }
  },
});

Onyx.connect({
  key: ONYXKEYS.PERSONAL_DETAILS_LIST,
  callback: value => {
    if (!value || timezone) {
      return;
    }

    timezone = value?.[currentUserID]?.timezone ?? {};
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions()
      .timeZone as SelectedTimezone;

    // If the current timezone is different than the user's timezone, and their timezone is set to automatic, then update their timezone.
    if (timezone?.automatic && timezone?.selected !== currentTimezone) {
      timezone.selected = currentTimezone;
      PersonalDetails.updateAutomaticTimezone({
        automatic: true,
        selected: currentTimezone,
      });
    }
  },
});

Onyx.connect({
  key: ONYXKEYS.IS_LOADING_APP,
  callback: value => {
    isLoadingApp = !!value;
  },
});

Onyx.connect({
  key: ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
  callback: (value: OnyxEntry<number>) => {
    lastUpdateIDAppliedToClient = value;
  },
});

function handleNetworkReconnect() {
  if (isLoadingApp) {
    App.openApp();
  } else {
    Log.info('[handleNetworkReconnect] Sending ReconnectApp');
    App.reconnectApp(lastUpdateIDAppliedToClient);
  }
}

const RootStack = createCustomStackNavigator<AuthScreensParamList>();
// We want to delay the re-rendering for components
// that depends on modal visibility until Modal is completely closed and its focused
// When modal screen is focused, update modal visibility in Onyx
// https://reactnavigation.org/docs/navigation-events/

const modalScreenListeners = {
  focus: () => {
    Modal.setModalVisibility(true);
  },
  blur: () => {
    Modal.setModalVisibility(false);
  },
  beforeRemove: () => {
    // Clear search input (WorkspaceInvitePage) when modal is closed
    // SearchInputManager.searchInput = '';
    Modal.setModalVisibility(false);
    Modal.willAlertModalBecomeVisible(false);
  },
};

function AuthScreens({
  session,
  initialLastUpdateIDAppliedToClient,
}: AuthScreensProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {isSmallScreenWidth} = useWindowDimensions();
  // const {shouldUseNarrowLayout} = useOnboardingLayout();
  const screenOptions = getRootNavigatorScreenOptions(
    isSmallScreenWidth,
    styles,
    StyleUtils,
  );
  const isInitialRender = useRef(true);

  const tzFixModalScreenOptions = useMemo(
    () => getTzFixModalScreenOptions(isSmallScreenWidth, styles, StyleUtils),
    [StyleUtils, isSmallScreenWidth, styles],
  );

  if (isInitialRender.current) {
    Timing.start(CONST.TIMING.HOMEPAGE_INITIAL_RENDER);
    isInitialRender.current = false;
  }

  useEffect(() => {
    const shortcutsOverviewShortcutConfig = CONST.KEYBOARD_SHORTCUTS.SHORTCUTS;
    const searchShortcutConfig = CONST.KEYBOARD_SHORTCUTS.SEARCH;
    const chatShortcutConfig = CONST.KEYBOARD_SHORTCUTS.NEW_CHAT;
    const currentUrl = getCurrentUrl();
    const isLoggingInAsNewUser =
      !!session?.email &&
      SessionUtils.isLoggingInAsNewUser(currentUrl, session.email);
    // Sign out the current user if we're transitioning with a different user
    const isTransitioning = currentUrl.includes(ROUTES.TRANSITION_BETWEEN_APPS);
    const isSupportalTransition = currentUrl.includes('authTokenType=support');
    // TODO enable this after signing in is put into place
    // if (isLoggingInAsNewUser && isTransitioning) {
    //   Session.signOutAndRedirectToSignIn(false, isSupportalTransition);
    //   return;
    // }

    // TODO enable this
    // NetworkConnection.listenForReconnect();
    // NetworkConnection.onReconnect(handleNetworkReconnect);
    // PusherConnectionManager.init();
    // Pusher.init({
    //   appKey: CONFIG.PUSHER.APP_KEY,
    //   cluster: CONFIG.PUSHER.CLUSTER,
    //   authEndpoint: `${CONFIG.KIROKU.DEFAULT_API_ROOT}api/AuthenticatePusher?`,
    // }).then(() => {
    //   User.subscribeToUserEvents();
    // });

    // If we are on this screen then we are "logged in", but the user might not have "just logged in". They could be reopening the app
    // or returning from background. If so, we'll assume they have some app data already and we can call reconnectApp() instead of openApp().
    // TODO enable this after the API is working
    // if (SessionUtils.didUserLogInDuringSession()) {
    //   App.openApp();
    // } else {
    //   Log.info('[AuthScreens] Sending ReconnectApp');
    //   App.reconnectApp(initialLastUpdateIDAppliedToClient);
    // }

    // PriorityMode.autoSwitchToFocusMode();

    App.setUpPoliciesAndNavigate(session);

    App.redirectThirdPartyDesktopSignIn();

    // Download.clearDownloads();

    Timing.end(CONST.TIMING.HOMEPAGE_INITIAL_RENDER);

    // Listen to keyboard shortcuts for opening certain pages
    // const unsubscribeShortcutsOverviewShortcut = KeyboardShortcut.subscribe(
    //   shortcutsOverviewShortcutConfig.shortcutKey,
    //   () => {
    //     Modal.close(() => {
    //       if (Navigation.isActiveRoute(ROUTES.KEYBOARD_SHORTCUTS)) {
    //         return;
    //       }
    //       return Navigation.navigate(ROUTES.KEYBOARD_SHORTCUTS);
    //     });
    //   },
    //   shortcutsOverviewShortcutConfig.descriptionKey,
    //   shortcutsOverviewShortcutConfig.modifiers,
    //   true,
    // );

    // Listen for the key K being pressed so that focus can be given to
    // the chat switcher, or new group chat
    // based on the key modifiers pressed and the operating system
    // const unsubscribeSearchShortcut = KeyboardShortcut.subscribe(
    //   searchShortcutConfig.shortcutKey,
    //   () => {
    //     Modal.close(
    //       Session.checkIfActionIsAllowed(() =>
    //         Navigation.navigate(ROUTES.SEARCH),
    //       ),
    //     );
    //   },
    //   shortcutsOverviewShortcutConfig.descriptionKey,
    //   shortcutsOverviewShortcutConfig.modifiers,
    //   true,
    // );

    // const unsubscribeChatShortcut = KeyboardShortcut.subscribe(
    //   chatShortcutConfig.shortcutKey,
    //   () => {
    //     Modal.close(
    //       Session.checkIfActionIsAllowed(() => Navigation.navigate(ROUTES.NEW)),
    //     );
    //   },
    //   chatShortcutConfig.descriptionKey,
    //   chatShortcutConfig.modifiers,
    //   true,
    // );

    return () => {
      // unsubscribeShortcutsOverviewShortcut();
      // unsubscribeSearchShortcut();
      // unsubscribeChatShortcut();
      Session.cleanupSession();
    };

    // Rule disabled because this effect is only for component did mount & will component unmount lifecycle event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // const CentralPaneScreenOptions = {
  //   headerShown: false,
  //   title: 'Kiroku',

  //   // Prevent unnecessary scrolling
  //   cardStyle: styles.cardStyleNavigator,
  // };

  return (
    // <ComposeProviders components={[OptionsListContextProvider, SearchContextProvider]}>
    <DatabaseDataProvider>
      <View style={styles.rootNavigatorContainerStyles(isSmallScreenWidth)}>
        <RootStack.Navigator
          screenOptions={screenOptions.centralPaneNavigator}
          isSmallScreenWidth={isSmallScreenWidth}>
          <RootStack.Screen
            name={NAVIGATORS.BOTTOM_TAB_NAVIGATOR}
            options={screenOptions.bottomTab}
            component={BottomTabNavigator}
          />
          <RootStack.Screen
            name={SCREENS.NOT_FOUND}
            options={screenOptions.fullScreen}
            component={NotFoundScreen}
          />
          <RootStack.Screen
            name={NAVIGATORS.RIGHT_MODAL_NAVIGATOR}
            options={screenOptions.rightModalNavigator}
            component={RightModalNavigator}
            listeners={modalScreenListeners}
          />
          <RootStack.Screen
            name={NAVIGATORS.TZ_FIX_NAVIGATOR}
            options={tzFixModalScreenOptions}
            component={TzFixModalNavigator}
            listeners={{
              focus: () => {
                Modal.setDisableDismissOnEscape(true);
              },
              beforeRemove: () => Modal.setDisableDismissOnEscape(false),
            }}
          />
          {/* <RootStack.Screen
          name={NAVIGATORS.FULL_SCREEN_NAVIGATOR}
          options={screenOptions.fullScreen}
          component={FullScreenNavigator}
        /> */}
          {/* <RootStack.Screen
          name={NAVIGATORS.LEFT_MODAL_NAVIGATOR}
          options={screenOptions.leftModalNavigator}
          component={LeftModalNavigator}
          listeners={modalScreenListeners}
        /> */}
          {/* <RootStack.Screen
          name={SCREENS.DESKTOP_SIGN_IN_REDIRECT}
          options={screenOptions.fullScreen}
          component={DesktopSignInRedirectPage}
        /> */}
          {/* {Object.entries(CENTRAL_PANE_SCREENS).map(
            ([screenName, componentGetter]) => {
              const centralPaneName = screenName as CentralPaneName;
              return (
                <RootStack.Screen
                  key={centralPaneName}
                  name={centralPaneName}
                  initialParams={getCentralPaneScreenInitialParams(
                    centralPaneName,
                    initialReportID,
                  )}
                  getComponent={componentGetter}
                  options={CentralPaneScreenOptions}
                />
              );
            },
          )} */}
        </RootStack.Navigator>
      </View>
    </DatabaseDataProvider>
    // </ComposeProviders>
  );
}

AuthScreens.displayName = 'AuthScreens';

const AuthScreensMemoized = memo(AuthScreens, () => true);

export default withOnyx<AuthScreensProps, AuthScreensProps>({
  session: {
    key: ONYXKEYS.SESSION,
  },
  initialLastUpdateIDAppliedToClient: {
    key: ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
  },
})(AuthScreensMemoized);
