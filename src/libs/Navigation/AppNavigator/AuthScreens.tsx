import React, {memo, useEffect, useMemo, useRef} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
// import OptionsListContextProvider from '@components/OptionListContextProvider';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
// import type {AuthScreensParamList} from '@libs/Navigation/types';
// import PusherConnectionManager from '@libs/PusherConnectionManager';
// import DesktopSignInRedirectPage from '@pages/signin/DesktopSignInRedirectPage';
import * as App from '@userActions/App';
// import * as Download from '@userActions/Download';
import * as Modal from '@userActions/Modal';
// import * as PriorityMode from '@userActions/PriorityMode';
import * as Session from '@userActions/Session';
import Timing from '@userActions/Timing';
import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
// import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import CrashReportingSync from '@components/CrashReportingSync';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import {useSplashScreenStateContext} from '@context/global/SplashScreenStateContext';
import * as Pusher from '@libs/Pusher/pusher';
import * as ApiUtils from '@libs/ApiUtils';
import kirokuPusherAuthorizer from '@libs/Pusher/kirokuAuthorizer';
import type ReactComponentModule from '@src/types/utils/ReactComponentModule';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useIdlePrefetch from '@hooks/useIdlePrefetch';
import useAutoUpdateTimezone from '@hooks/useAutoUpdateTimezone';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import prefetchStatisticsBundle from '@screens/Statistics/prefetchStatisticsBundle';
import {useFirebase} from '@context/global/FirebaseContext';
import OnboardingGuard from '@libs/Navigation/guards/OnboardingGuard';
import TermsReConsentGuard from '@libs/Navigation/guards/TermsReConsentGuard';
import createCustomStackNavigator from './createCustomStackNavigator';
import getRootNavigatorScreenOptions from './getRootNavigatorScreenOptions';
import BottomTabNavigator from './Navigators/BottomTabNavigator';
// import CentralPaneNavigator from './Navigators/CentralPaneNavigator';
// import FullScreenNavigator from './Navigators/FullScreenNavigator';
// import LeftModalNavigator from './Navigators/LeftModalNavigator';
import OnboardingModalNavigator from './Navigators/OnboardingModalNavigator';
import RightModalNavigator from './Navigators/RightModalNavigator';
import {
  DayOverviewModalStackNavigator,
  SessionsCalendarModalStackNavigator,
} from './ModalStackNavigators';
// import WelcomeVideoModalNavigator from './Navigators/WelcomeVideoModalNavigator';

// eslint-disable-next-line rulesdir/no-negated-variables
const notFoundScreen = () =>
  require<ReactComponentModule>('@screens/ErrorScreen/NotFoundScreen').default;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let lastUpdateIDAppliedToClient: OnyxEntry<number>;

Onyx.connect({
  key: ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
  callback: (value: OnyxEntry<number>) => {
    lastUpdateIDAppliedToClient = value;
  },
});

// function handleNetworkReconnect() {
//   if (isLoadingApp) {
//     App.openApp();
//   } else {
//     Log.info('[handleNetworkReconnect] Sending ReconnectApp');
//     App.reconnectApp(lastUpdateIDAppliedToClient);
//   }
// }

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const RootStack = createCustomStackNavigator();
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

// Module graphs warmed once the authenticated app is idle, so the first open
// of these screens is a cache hit instead of a cold parse on the critical path.
const IDLE_PREFETCHERS = [prefetchStatisticsBundle];

function AuthScreensContent() {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {auth} = useFirebase();

  // Keep the stored timezone in sync with the device at login and on foreground.
  useAutoUpdateTimezone();

  // We need to use isSmallScreenWidth for the root stack navigator
  const {
    shouldUseNarrowLayout,
    onboardingIsMediumOrLargerScreenWidth,
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    isSmallScreenWidth,
  } = useResponsiveLayout();
  const screenOptions = getRootNavigatorScreenOptions(
    isSmallScreenWidth,
    styles,
    StyleUtils,
  );

  // Signal "auth data ready" to the boot splash gate in Kiroku.tsx. The
  // splash hides only once these two fields have arrived from the live
  // listener — matches HomeScreen's own render gate so the user sees the
  // splash continuously until real content can paint.
  // `useCurrentUserData` returns {} (truthy) while loading; the auth-ready gate
  // below must treat the empty object as "not loaded", so map empty → undefined.
  const currentUserData = useCurrentUserData();
  const userData = isEmptyObject(currentUserData) ? undefined : currentUserData;
  const preferences = useCurrentUserPreferences();
  const {setIsAuthDataReady} = useSplashScreenStateContext();
  useEffect(() => {
    if (userData === undefined || preferences === undefined) {
      return;
    }
    setIsAuthDataReady(true);
  }, [userData, preferences, setIsAuthDataReady]);
  // Safety: if the listener doesn't deliver both fields within the
  // timeout (offline cold start, slow network, or missing fields in the
  // user's RTDB document), flip the gate anyway. HomeScreen renders
  // skeletons until real data arrives, so this falls back to a brief
  // skeleton flash instead of leaving the user staring at the splash.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsAuthDataReady(true);
    }, CONST.BOOT_SPLASH_AUTH_DATA_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [setIsAuthDataReady]);
  // Reset on sign-out (AuthScreens unmounts) so a subsequent sign-in
  // re-gates the splash on fresh data.
  useEffect(() => () => setIsAuthDataReady(false), [setIsAuthDataReady]);

  const onboardingModalScreenOptions = useMemo(
    () =>
      screenOptions.onboardingModalNavigator(
        onboardingIsMediumOrLargerScreenWidth,
      ),
    [screenOptions, onboardingIsMediumOrLargerScreenWidth],
  );
  const isInitialRender = useRef(true);

  if (isInitialRender.current) {
    Timing.start(CONST.TIMING.HOMEPAGE_INITIAL_RENDER);
    isInitialRender.current = false;
  }

  useEffect(() => {
    // const shortcutsOverviewShortcutConfig = CONST.KEYBOARD_SHORTCUTS.SHORTCUTS;
    // const searchShortcutConfig = CONST.KEYBOARD_SHORTCUTS.SEARCH;
    // const chatShortcutConfig = CONST.KEYBOARD_SHORTCUTS.NEW_CHAT;
    // const currentUrl = getCurrentUrl();
    const user = auth?.currentUser;
    // const isLoggingInAsNewUser = !!user?.email;
    // && SessionUtils.isLoggingInAsNewUser(currentUrl, user.email);
    // Sign out the current user if we're transitioning with a different user
    // const isTransitioning = currentUrl.includes(ROUTES.TRANSITION_BETWEEN_APPS);
    // const isSupportalTransition = currentUrl.includes('authTokenType=support');
    // TODO enable this after signing in is put into place
    // if (isLoggingInAsNewUser && isTransitioning) {
    //   Session.signOutAndRedirectToSignIn(false, isSupportalTransition);
    //   return;
    // }

    // TODO enable this
    // NetworkConnection.listenForReconnect();
    // NetworkConnection.onReconnect(handleNetworkReconnect);
    // PusherConnectionManager.init();
    Pusher.registerCustomAuthorizer(kirokuPusherAuthorizer);
    Pusher.init({
      appKey: CONFIG.PUSHER.APP_KEY,
      cluster: CONFIG.PUSHER.CLUSTER,
      authEndpoint: `${ApiUtils.getKirokuApiRoot()}/v1/pusher/auth`,
    }).then(() => {
      User.subscribeToUserEvents();
      // Global app config broadcasts on a public channel (no per-user auth), but
      // co-locating the subscription here keeps all Pusher wiring at boot.
      User.subscribeToConfigEvents();
    });

    // Hydrate the signed-in user's data and seed the realtime `lastUpdateID`
    // baseline via GET /v1/app/open. (The reconnectApp-vs-openApp optimization
    // gated on `didUserLogInDuringSession` isn't wired yet — see #774.)
    App.openApp();

    // PriorityMode.autoSwitchToFocusMode();

    App.setUpPoliciesAndNavigate(user);

    App.redirectThirdPartyDesktopSignIn();

    // Download.clearDownloads();

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
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, []);

  // Warm heavy screen bundles (the Statistics chart graph) once the app is
  // idle, so their first open is a cache hit rather than a cold parse on the
  // navigation critical path.
  useIdlePrefetch(IDLE_PREFETCHERS);

  // const CentralPaneScreenOptions = {
  //   headerShown: false,
  //   title: 'Kiroku',

  //   // Prevent unnecessary scrolling
  //   cardStyle: styles.cardStyleNavigator,
  // };

  return (
    // <ComposeProviders components={[OptionsListContextProvider, SearchContextProvider]}>
    <View style={styles.rootNavigatorContainerStyles(shouldUseNarrowLayout)}>
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
          getComponent={notFoundScreen}
        />
        <RootStack.Screen
          name={NAVIGATORS.RIGHT_MODAL_NAVIGATOR}
          options={screenOptions.rightModalNavigator}
          component={RightModalNavigator}
          listeners={modalScreenListeners}
        />
        <RootStack.Screen
          name={NAVIGATORS.SESSIONS_CALENDAR_NAVIGATOR}
          options={screenOptions.sessionsCalendarNavigator}
          component={SessionsCalendarModalStackNavigator}
        />
        <RootStack.Screen
          name={NAVIGATORS.DAY_OVERVIEW_NAVIGATOR}
          options={screenOptions.dayOverviewNavigator}
          component={DayOverviewModalStackNavigator}
          listeners={modalScreenListeners}
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
        {/*
          The onboarding modal screen is ALWAYS mounted. Visibility is owned by
          React Navigation focus state, not Onyx. Conditionally mounting on
          `shouldFireOnboarding` causes the screen to disappear synchronously
          the moment `completed_at` lands in Onyx, which kills the dismissal
          transition and produces a Home-flash. Entry is driven by
          `OnboardingGuard`; exit by `navigateAfterOnboarding()`.
        */}
        <RootStack.Screen
          name={NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR}
          options={onboardingModalScreenOptions}
          component={OnboardingModalNavigator}
          listeners={{
            focus: () => {
              Modal.setDisableDismissOnEscape(true);
            },
            beforeRemove: () => Modal.setDisableDismissOnEscape(false),
          }}
        />
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
      <OnboardingGuard />
      <TermsReConsentGuard />
    </View>
    // </ComposeProviders>
  );
}

AuthScreensContent.displayName = 'AuthScreensContent';

function AuthScreens() {
  return (
    <>
      <CrashReportingSync />
      <AuthScreensContent />
    </>
  );
}

AuthScreens.displayName = 'AuthScreens';

const AuthScreensMemoized = memo(AuthScreens, () => true);
export default AuthScreensMemoized;
