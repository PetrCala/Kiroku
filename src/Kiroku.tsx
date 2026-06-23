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
import SplashScreenStateContext from '@context/global/SplashScreenStateContext';
import {useConfig} from '@context/global/ConfigContext';
import Navigation from './libs/Navigation/Navigation';
import NavigationRoot from './libs/Navigation/NavigationRoot';
// import PushNotification from '@libs/Notification/PushNotification';
import SplashScreenHider from './components/SplashScreenHider';
import Log from './libs/Log';
import migrateOnyx from './libs/migrateOnyx';
import BootSplash from './libs/BootSplash';
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
import UpdateAppModal from './components/UpdateAppModal';
import ForceUpdateModal from './components/Modals/ForceUpdateModal';
import VerifyEmailModal from './components/VerifyEmailModal';
import AccountSuspendedModal from './components/Modals/AccountSuspendedModal';
import FullScreenLoadingIndicator from './components/FullscreenLoadingIndicator';
import StatsPerfDebugButton from './components/StatsPerfDebugButton';
import useNativeAppearanceSync from './hooks/useNativeAppearanceSync';
import useCurrentUserData from './hooks/useCurrentUserData';
import colors from './styles/theme/colors';
import CONST from './CONST';

// Painted on top of NavigationRoot but below SplashScreenHider (zIndex 20)
// while the splash is up, so any one-frame mount lag in SplashScreenHider's
// tree can never expose React Navigation's white appBG. Plain View only
// — every JS-rendered child has its own first-paint lag, so the guard
// contributes the color, not the logo. The native loadingView covers the
// logo until SplashScreenHider catches up.
const splashGuardStyle = {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: colors.yellowStrong,
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
  const appStateChangeListener = useRef<NativeEventSubscription | null>(null);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [isOnyxMigrated, setIsOnyxMigrated] = useState(false);
  const {
    splashScreenState,
    setSplashScreenState,
    isAuthDataReady,
    setIsAuthDataReady,
    setIsLogoHandoffActive,
  } = useContext(SplashScreenStateContext);
  const [lastVisitedPath] = useOnyx(ONYXKEYS.LAST_VISITED_PATH);
  const [lastRoute] = useOnyx(ONYXKEYS.LAST_ROUTE);
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const [hasCheckedAutoLogin] = useOnyx(ONYXKEYS.HAS_CHECKED_AUTO_LOGIN);
  const [preferredTheme, preferredThemeMetadata] = useOnyx(
    ONYXKEYS.PREFERRED_THEME,
  );

  // Keep the native interface style in sync with the chosen theme so native,
  // system-drawn surfaces (most visibly the iOS Liquid Glass tab bar's moving
  // selection capsule) don't render their light variant over the dark theme.
  useNativeAppearanceSync();

  const {config} = useConfig();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // An admin ban pushes `banned: true` onto the signed-in user's own record
  // (Kiroku #1238); lock the app out immediately rather than waiting for the
  // Firebase token to expire.
  const currentUserData = useCurrentUserData();
  const isAccountSuspended =
    isAuthenticated && currentUserData?.banned === true;
  const [authenticationChecked, setAuthenticationChecked] = useState(false);
  const [isUnderMaintenance, setIsUnderMaintenance] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [updateRequiredFromConfig, setUpdateRequiredFromConfig] =
    useState<boolean>(false);
  const [updateRequiredFromBackend] = useOnyx(ONYXKEYS.UPDATE_REQUIRED);
  const updateRequired =
    updateRequiredFromConfig || !!updateRequiredFromBackend;
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
    setUpdateRequiredFromConfig(newUpdateRequired);
    setShouldShowUpdateModal(newShouldShowUpdateModal);
  }, [config, shouldShowVerifyEmailModal]);

  // A required update replaces the entire app tree via the early return below,
  // so SplashScreenHider never mounts to hide the native splash — do it here.
  useEffect(() => {
    if (!updateRequired) {
      return;
    }
    BootSplash.hide();
  }, [updateRequired]);

  // authenticationChecked (Firebase onAuthStateChanged) is an alternative to
  // hasCheckedAutoLogin so that navigating directly to /auth (bypassing
  // InitialScreen, which is the normal setter) can still clear the splash.
  // HAS_CHECKED_AUTO_LOGIN initialises to `false` in initialKeyStates (not
  // null/undefined), so treat `=== true` as the "set" gate before falling back.
  const shouldInit =
    isNavigationReady &&
    (hasCheckedAutoLogin === true || authenticationChecked);

  // Wait until Onyx has finished hydrating PREFERRED_THEME from local storage
  // before hiding the splash. Otherwise the ThemeProvider renders one frame
  // with the default light theme and then re-renders with the stored dark
  // preference, producing a visible white flash.
  const isThemeReady = preferredThemeMetadata.status === 'loaded';

  // For authenticated users, wait for the user's RTDB data (userData +
  // preferences) to hydrate before hiding the splash, so the home screen
  // can paint real content immediately and OnboardingGuard can redirect
  // without flicker. The fast path is set from inside AuthScreens via
  // `setIsAuthDataReady` once data lands; the bounded backstop below guarantees
  // it resolves even if AuthScreens never reaches a stable mount. For
  // unauthenticated users this condition is bypassed — the public stack is
  // ready as soon as nav + theme are ready.
  const isAuthScreenReady = !isAuthenticated || isAuthDataReady;

  // Backstop for the authenticated splash gate, owned HERE rather than in
  // AuthScreens. `isAuthDataReady` was previously settable only from inside
  // AuthScreensContent (the data-arrival effect and its own timeout). But
  // AuthScreens is lazy-loaded behind <Suspense fallback={null}> and mounts
  // only after `onAuthStateChanged` fires, whereas the VerifyEmailModal renders
  // straight from `isAuthenticated` here — so when the AuthScreens chunk-load or
  // mount loses the boot race (~1 in 8 under load), the modal shows but the
  // gate's only setter never runs and the splash is pinned forever (web #splash
  // is z-index 10000 and swallows every click). Tying the backstop to
  // `isAuthenticated` makes it fire regardless of AuthScreens, so the gate can't
  // deadlock. The 15s SplashScreenHider net remains as the last resort.
  useEffect(() => {
    if (!isAuthenticated || isAuthDataReady) {
      return undefined;
    }
    const timeoutId = setTimeout(() => {
      setIsAuthDataReady(true);
    }, CONST.BOOT_SPLASH_AUTH_DATA_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, isAuthDataReady, setIsAuthDataReady]);

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
  // BootSplash.hide(), which crossDissolves the in-process storyboard
  // subview over 250ms — that transition also forces iOS to render the
  // React tree underneath, masking Fabric's incremental mounting cascade.
  // The overlay owns the 15s force-hide safety timeout so a stuck gating
  // condition can't pin the splash forever.
  const onSplashHide = useCallback(() => {
    setSplashScreenState(CONST.BOOT_SPLASH_STATE.HIDDEN);
    // The logo handoff (if any) is finished once the splash is hidden. Clear
    // the flag so a later logout remount of InitialScreen plays its assembly
    // entrance again — the InitialScreen logo that just received the handoff is
    // already latched-settled, so it ignores the change.
    setIsLogoHandoffActive(false);
  }, [setSplashScreenState, setIsLogoHandoffActive]);

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

  // If the splash is still up this long, it's stuck. Log a full snapshot of the
  // gate inputs so the offender is obvious, then SplashScreenHider's 15s net
  // force-hides just after. Fires one tick before the net so it captures the
  // still-stuck state; on a healthy boot the splash hides in a couple seconds
  // and this never runs. All gates are already in scope here, so the breadcrumb
  // lives with the data rather than being plumbed into the overlay.
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
            shouldInit,
            isNavigationReady,
            hasCheckedAutoLogin,
            authenticationChecked,
            isThemeReady,
            preferredThemeStatus: preferredThemeMetadata.status,
            isAuthenticated,
            isAuthDataReady,
            isAuthScreenReady,
            shouldShowVerifyEmailModal,
            isOnyxMigrated,
            updateRequired,
            updateAvailable,
            preferredTheme,
            lastVisitedPath,
          },
        },
        false,
      );
    }, CONST.BOOT_SPLASH_STUCK_LOG_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [
    splashScreenState,
    shouldInit,
    isNavigationReady,
    hasCheckedAutoLogin,
    authenticationChecked,
    isThemeReady,
    preferredThemeMetadata.status,
    isAuthenticated,
    isAuthDataReady,
    isAuthScreenReady,
    shouldShowVerifyEmailModal,
    isOnyxMigrated,
    updateRequired,
    updateAvailable,
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
    return <ForceUpdateModal />;
  }

  // Always render the splash guard and SplashScreenHider, even before
  // Onyx has migrated. Returning `null` before isOnyxMigrated would
  // commit an empty tree, and the React surface would still transition
  // to "Running" stage on that empty commit, leaving the guard +
  // SplashScreenHider unmounted while the native loadingView starts to
  // dissolve. Gate only the heavier subtree (NavigationRoot + modals)
  // on isOnyxMigrated.
  return (
    <>
      {isOnyxMigrated && (
        <>
          {loadingText ? (
            <FullScreenLoadingIndicator loadingText={loadingText} />
          ) : (
            isUnderMaintenance && <UnderMaintenanceModal config={config} />
          )}

          {shouldInit &&
            (isAccountSuspended ? (
              // A suspended account supersedes every other gate — the only
              // affordance is sign-out.
              <AccountSuspendedModal />
            ) : (
              <>
                {shouldShowVerifyEmailModal && <VerifyEmailModal />}
                {shouldShowUpdateModal && <UpdateAppModal />}
                {/* // TODO show shared session invites here */}
              </>
            ))}

          <NavigationRoot
            onReady={setNavigationReady}
            authenticated={isAuthenticated}
            lastVisitedPath={lastVisitedPath as Route}
            initialUrl={initialUrl}
          />
        </>
      )}
      {/*
        Guard layer between NavigationRoot and SplashScreenHider. Hides
        NavigationContainer's white appBG during any frame where
        SplashScreenHider's tree lags first paint. Unmounted as soon as
        shouldHideSplash flips so the native cross-dissolve in
        BootSplash.hide() can reveal the real content underneath.
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
      {/* Web-only, non-prod: one-click opener for the StatsPerf diagnostics
          panel (diagnostic branch only). No-op on native/production. */}
      <StatsPerfDebugButton />
    </>
  );
}

export default Kiroku;
export {SplashScreenHiddenContext};
