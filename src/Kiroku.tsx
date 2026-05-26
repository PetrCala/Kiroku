import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {NativeEventSubscription} from 'react-native';
import {AppState, Linking, Platform, StyleSheet, View} from 'react-native';
import Onyx, {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import {useUserConnection} from '@context/global/UserConnectionContext';
import SplashScreenStateContext from '@context/global/SplashScreenStateContext';
import {useConfig} from '@context/global/ConfigContext';
import Navigation from './libs/Navigation/Navigation';
import NavigationRoot from './libs/Navigation/NavigationRoot';
// import PushNotification from '@libs/Notification/PushNotification';
import SplashScreenHider from './components/SplashScreenHider';
import Log from './libs/Log';
import migrateOnyx from './libs/migrateOnyx';
import * as ActiveClientManager from './libs/ActiveClientManager';
import * as UserUtils from './libs/UserUtils';
import Visibility from './libs/Visibility';
import ONYXKEYS from './ONYXKEYS';
import type {Route} from './ROUTES';
import {updateLastRoute} from './libs/actions/App';
import * as Subscriptions from './libs/actions/Subscriptions';
import setCrashlyticsUserId from './libs/setCrashlyticsUserId';
import {checkIfUnderMaintenance} from './libs/Maintenance';
import {validateAppVersion} from './libs/Validation';
import UnderMaintenanceModal from './components/Modals/UnderMaintenanceModal';
import UserOfflineModal from './components/UserOfflineModal';
import CONFIG from './CONFIG';
import UpdateAppModal from './components/UpdateAppModal';
import VerifyEmailModal from './components/VerifyEmailModal';
import FullScreenLoadingIndicator from './components/FullscreenLoadingIndicator';
import CONST from './CONST';

// DIAGNOSTIC v8 — DO NOT MERGE.
// Tag the guard layer BLUE. If we see blue during the orange-only gap,
// the guard is painted but SplashScreenHider is not. If we don't see
// blue, the guard isn't reaching the framebuffer either.
const splashGuardStyle = {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'blue',
  zIndex: 19,
};

Onyx.registerLogger(({level, message}) => {
  if (level === 'alert') {
    Log.alert(message);
    console.error(message);
  } else {
    Log.info(message);
  }
});

const SplashScreenHiddenContext = React.createContext({});

function Kiroku() {
  const {auth} = useFirebase();
  const {isOnline} = useUserConnection();
  const appStateChangeListener = useRef<NativeEventSubscription | null>(null);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [isOnyxMigrated, setIsOnyxMigrated] = useState(false);
  const {splashScreenState, setSplashScreenState, isAuthDataReady} = useContext(
    SplashScreenStateContext,
  );
  const [lastVisitedPath] = useOnyx(ONYXKEYS.LAST_VISITED_PATH);
  const [lastRoute] = useOnyx(ONYXKEYS.LAST_ROUTE);
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const [hasCheckedAutoLogin] = useOnyx(ONYXKEYS.HAS_CHECKED_AUTO_LOGIN);
  const [preferredTheme, preferredThemeMetadata] = useOnyx(
    ONYXKEYS.PREFERRED_THEME,
  );
  const {config} = useConfig();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticationChecked, setAuthenticationChecked] = useState(false);
  const [isUnderMaintenance, setIsUnderMaintenance] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [updateRequired, setUpdateRequired] = useState<boolean>(false);
  const [shouldShowVerifyEmailModal, setShouldShowVerifyEmailModal] =
    useState<boolean>(false);
  const [shouldShowUpdateModal, setShouldShowUpdateModal] =
    useState<boolean>(false);

  // const isAuthenticated = useMemo(() => !!(auth.currentUser ?? null), [auth]);
  // const autoAuthState = useMemo(() => session?.autoAuthState ?? '', [session]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setIsAuthenticated(!!user);
      setAuthenticationChecked(true);

      if (user?.uid) {
        Subscriptions.identify(user.uid);
      }

      // Re-evaluate on every auth change: sign-out must drop the modal so it
      // doesn't reappear over the public stack after the user taps "Sign out"
      // from inside VerifyEmailModal itself.
      setShouldShowVerifyEmailModal(UserUtils.shouldShowVerifyEmailModal(user));
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!config) {
      return;
    }
    const underMaintenance: boolean = checkIfUnderMaintenance(
      config?.maintenance,
    );
    const versionValidationResult = validateAppVersion(config.app_settings);
    const newUpdateAvailable = !!versionValidationResult?.updateAvailable;
    const newUpdateRequired = !versionValidationResult.success;
    const newShouldShowUpdateModal =
      !shouldShowVerifyEmailModal &&
      UserUtils.shouldShowUpdateModal(newUpdateAvailable, newUpdateRequired);

    setIsUnderMaintenance(underMaintenance);
    setUpdateAvailable(newUpdateAvailable);
    setUpdateRequired(newUpdateRequired);
    setShouldShowUpdateModal(newShouldShowUpdateModal);
  }, [config, shouldShowVerifyEmailModal]);

  const shouldInit = isNavigationReady && hasCheckedAutoLogin;

  // Wait until Onyx has finished hydrating PREFERRED_THEME from local storage
  // before hiding the splash. Otherwise the ThemeProvider renders one frame
  // with the default light theme and then re-renders with the stored dark
  // preference, producing a visible white flash.
  const isThemeReady = preferredThemeMetadata.status === 'loaded';

  // For authenticated users, wait for the user's RTDB data (userData +
  // preferences) to hydrate before hiding the splash, so the home screen
  // can paint real content immediately and OnboardingGuard can redirect
  // without flicker. The signal is set from inside AuthScreens (which
  // lives below DatabaseDataProvider) via `setIsAuthDataReady`. For
  // unauthenticated users this condition is bypassed — the public stack
  // is ready as soon as nav + theme are ready.
  const isAuthScreenReady = !isAuthenticated || isAuthDataReady;

  const shouldHideSplash = !!(
    shouldInit &&
    authenticationChecked &&
    isThemeReady &&
    isAuthScreenReady &&
    splashScreenState === CONST.BOOT_SPLASH_STATE.VISIBLE
  );

  const initializeClient = () => {
    if (!Visibility.isVisible()) {
      return;
    }

    ActiveClientManager.init();
  };

  const setNavigationReady = useCallback(() => {
    setIsNavigationReady(true);

    // Navigate to any pending routes now that the NavigationContainer is ready
    Navigation.setIsNavigationReady();
  }, []);

  // Splash hide is driven by <SplashScreenHider /> below. It calls
  // BootSplash.hide() (the 250ms native crossDissolve under the in-process
  // storyboard subview) and then runs its own 250ms JS scale+opacity fade
  // before signaling onHide here. The JS overlay covers the React tree the
  // whole time, so the home screen's first-paint loading indicator is not
  // visible to the user before content arrives — the same masking the old
  // pre-PR #325 design provided. The overlay also owns the 15s force-hide
  // safety timeout so a stuck gating condition can't pin the splash forever.
  const onSplashHide = useCallback(() => {
    setSplashScreenState(CONST.BOOT_SPLASH_STATE.HIDDEN);
  }, [setSplashScreenState]);

  useLayoutEffect(() => {
    // Initialize this client as being an active client
    ActiveClientManager.init();

    // Used for the offline indicator appearing when someone is offline
    // NetworkConnection.subscribeToNetInfo(); // TODO enable this
  }, []);

  // Log the platform and config to debug .env issues
  useEffect(() => {
    Log.info('App launched', false, {Platform});
  }, []);

  useEffect(() => {
    if (splashScreenState !== CONST.BOOT_SPLASH_STATE.VISIBLE) {
      return undefined;
    }
    const timer = setTimeout(() => {
      Log.alert(
        '[BootSplash] splash screen is still visible',
        {
          propsToLog: {
            appState: AppState.currentState,
            updateRequired,
            updateAvailable,
            isAuthenticated,
            isThemeReady,
            preferredTheme,
            lastVisitedPath,
          },
        },
        false,
      );
    }, 30 * 1000);
    return () => clearTimeout(timer);
  }, [
    splashScreenState,
    updateRequired,
    updateAvailable,
    isAuthenticated,
    isThemeReady,
    preferredTheme,
    lastVisitedPath,
  ]);

  useEffect(() => {
    // Run any Onyx schema migrations and then continue loading the main app
    migrateOnyx().then(() => {
      // In case of a crash that led to disconnection, we want to remove all the push notifications.
      if (!isAuthenticated) {
        // PushNotification.clearNotifications(); // TODO
      }

      setIsOnyxMigrated(true);
    });

    appStateChangeListener.current = AppState.addEventListener(
      'change',
      initializeClient,
    );

    // If the app is opened from a deep link, get the session ID (if exists) from the deep link and navigate to the session
    Linking.getInitialURL().then(url => {
      setInitialUrl(url);
      // DrinkingSession.openSessionFromDeepLink(url ?? '');// Report.openReportFromDeepLink
    });

    // Open ession from a deep link (only mobile native)
    // Linking.addEventListener('url', state => {
    //   // DrinkingSession.openSessionFromDeepLink(state.url); // Report.openReportFromDeepLink
    // });

    return () => {
      if (!appStateChangeListener.current) {
        return;
      }
      appStateChangeListener.current.remove();
    };
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!isNavigationReady || !lastRoute) {
      return;
    }
    updateLastRoute('');
    Navigation.navigate(lastRoute as Route);
    // Disabling this rule because we only want it to run on the first render.
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [isNavigationReady]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    setCrashlyticsUserId(auth?.currentUser?.uid ?? '-1');
  }, [isAuthenticated, auth?.currentUser?.uid]);

  if (updateRequired) {
    throw new Error(CONST.ERROR.UPDATE_REQUIRED);
  }

  // DIAGNOSTIC v7 — DO NOT MERGE.
  // Don't return null before Onyx migrates. Otherwise the React surface
  // commits empty content, transitions to "Running", and the
  // RCTSurfaceHostingView activity indicator (our storyboard
  // loadingView) is removed BEFORE SplashScreenHider has anything in the
  // tree to paint — leaving the orange-only gap the user sees.
  //
  // Always render the splash guard and SplashScreenHider so the first
  // React commit has visible content; only gate the heavier subtree
  // (NavigationRoot + modals) on isOnyxMigrated.
  return (
    <>
      {isOnyxMigrated && (
        <>
          {loadingText ? (
            <FullScreenLoadingIndicator loadingText={loadingText} />
          ) : (
            <>
              {!isOnline && !CONFIG.IS_USING_EMULATORS && <UserOfflineModal />}
              {isUnderMaintenance && <UnderMaintenanceModal config={config} />}
            </>
          )}

          {shouldInit && (
            <>
              {shouldShowVerifyEmailModal && <VerifyEmailModal />}
              {shouldShowUpdateModal && <UpdateAppModal />}
              {/* // TODO show shared session invites here */}
            </>
          )}

          <NavigationRoot
            onReady={setNavigationReady}
            authenticated={isAuthenticated}
            lastVisitedPath={lastVisitedPath as Route}
            initialUrl={initialUrl}
          />
        </>
      )}
      {/*
        The guard sits between NavigationRoot and SplashScreenHider while the
        splash is at full opacity. It is unmounted the moment shouldHideSplash
        flips so SplashScreenHider's opacity fade can reveal real content
        instead of cross-fading against a yellow backdrop.
      */}
      {splashScreenState !== CONST.BOOT_SPLASH_STATE.HIDDEN &&
        !shouldHideSplash && (
          <View pointerEvents="none" style={splashGuardStyle} />
        )}
      {splashScreenState !== CONST.BOOT_SPLASH_STATE.HIDDEN && (
        <SplashScreenHider
          shouldHideSplash={shouldHideSplash}
          onHide={onSplashHide}
        />
      )}
    </>
  );
}

export default Kiroku;
export {SplashScreenHiddenContext};
