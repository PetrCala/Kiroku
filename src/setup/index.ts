import {I18nManager} from 'react-native';
import Onyx from 'react-native-onyx';
import * as App from '@userActions/App';
import * as Calendar from '@userActions/Calendar';
import * as Device from '@userActions/Device';
import * as Subscriptions from '@userActions/Subscriptions';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import intlPolyfill from '@libs/IntlPolyfill';
import {initFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import StartupMetrics from '@libs/StartupMetrics';
import initializeLastVisitedPath from './initializeLastVisitedPath';
import platformSetup from './platformSetup';
import suppressSkiaPathDeprecationWarnings from './suppressSkiaPathDeprecationWarnings';

export default function () {
  // Temporary: mute upstream victory-native Skia path deprecation warnings in
  // dev. Remove once victory-native adopts Skia.PathBuilder.
  suppressSkiaPathDeprecationWarnings();

  /*
   * Initialize the Onyx store when the app loads for the first time.
   *
   * Note: This Onyx initialization has been very intentionally placed completely outside of the React lifecycle of the main App component.
   *
   * To understand why we must do this, you must first understand that a typical React Native Android application consists of an Application and an Activity.
   * The project root's index.js runs in the Application, but the main RN `App` component + UI runs in a separate Activity, spawned when you call AppRegistry.registerComponent.
   * When an application launches in a headless JS context (i.e: when woken from a killed state by a push notification), only the Application is available, but not the UI Activity.
   * This means that in a headless context NO REACT CODE IS EXECUTED, and none of your components will mount.
   *
   * However, we still need to use Onyx to update the underlying app data from the headless JS context.
   * Therefore it must be initialized completely outside the React component lifecycle.
   */
  Onyx.init({
    keys: ONYXKEYS,

    // Increase the cached key count so that the app works more consistently for accounts with large numbers of reports
    maxCachedKeysCount: 20000,
    initialKeyStates: {
      // Clear any loading and error messages so they do not appear on app startup
      [ONYXKEYS.SESSION]: {loading: false},
      [ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM]: {
        ...CONST.DEFAULT_CLOSE_ACCOUNT_DATA,
      },
      [ONYXKEYS.NETWORK]: CONST.DEFAULT_NETWORK_DATA,
      [ONYXKEYS.IS_SIDEBAR_LOADED]: false,
      [ONYXKEYS.HAS_CHECKED_AUTO_LOGIN]: false,
      [ONYXKEYS.SHOULD_SHOW_COMPOSE_INPUT]: true,
      [ONYXKEYS.MODAL]: {
        isVisible: false,
        willAlertModalBecomeVisible: false,
      },
      // Always open the home route on app startup for native platforms by clearing the lastVisitedPath
      [ONYXKEYS.LAST_VISITED_PATH]: initializeLastVisitedPath(),
    },
  });

  // Reset the calendar's cross-screen sync state on every cold launch so the home
  // calendar always opens on the current month. Can't go in `initialKeyStates`
  // above: Onyx drops `null` defaults (shouldRemoveNestedNulls), so a value persisted
  // from a previous session would survive hydration. The action uses `Onyx.merge`,
  // which clears the persisted value; running here (before the React tree mounts)
  // clears it before any screen subscribes, so there's no month flip.
  Calendar.resetCalendarStateForColdLaunch();

  // Reset the OpenApp bootstrap flag for the same reason: it is persisted, and
  // the onboarding/terms readiness gates read `isLoadingApp === false` as
  // "this session's bootstrap completed". A stale `false` from a previous
  // session would open those gates before `openApp` runs.
  App.resetIsLoadingAppForColdLaunch();

  Device.setDeviceID();

  // No-op until RevenueCat keys land via env (#364); scaffolded ahead so the
  // internal-track AAB carries the BILLING permission today.
  Subscriptions.initialize();

  // Force app layout to work left to right because our design does not currently support devices using this mode
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);

  // Polyfill the Intl API if locale data is not as expected
  intlPolyfill();

  // Perform any other platform-specific setup
  platformSetup();

  // Initialize Firebase Auth once, here, where native modules are proven ready
  // (platformSetup() above already touches @react-native-firebase). Doing it at
  // this single, post-bridge point - instead of racing on whichever module hits
  // getFirebaseAuth() first - guarantees auth is created with persistence
  // (AsyncStorage on native, IndexedDB on web) so the session survives a cold
  // start. Resolves by platform extension, so no platform branching is needed.
  initFirebaseAuth();

  // Capture native cold-start marks (process spawn → first content visible)
  // and log them in the same `Timing:` format as Timing.ts so Grafana picks
  // them up.
  StartupMetrics.init();
}
