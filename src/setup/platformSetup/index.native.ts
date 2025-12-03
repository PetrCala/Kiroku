// REMOVED: import crashlytics from '@react-native-firebase/crashlytics';
// Crashlytics temporarily disabled - module removed from dependencies
// import Performance from '@libs/Performance';
import CONFIG from '@src/CONFIG';

/* eslint-disable rulesdir/prefer-early-return */

export default function () {
  // We do not want to send crash reports if we are on a locally built release version of the app.
  // Crashlytics is disabled by default for debug builds, but not local release builds so we are using
  // an environment variable to enable them in the staging & production apps and opt-out everywhere else.

  // REMOVED: Crashlytics module no longer available
  // if (!CONFIG.SEND_CRASH_REPORTS) {
  //   crashlytics().setCrashlyticsCollectionEnabled(false);
  // }

  // Performance.setupPerformanceObserver();
}
