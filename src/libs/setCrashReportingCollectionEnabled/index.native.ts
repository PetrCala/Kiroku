import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import {getPerformance} from '@react-native-firebase/perf';
import CONFIG from '@src/CONFIG';

/** Apply the user's crash-reporting preference to Crashlytics and Performance.
 *  Effective collection is gated by the build flag — we never enable
 *  collection in a build that opted out at compile time. */
const setCrashReportingCollectionEnabled = (userPrefEnabled: boolean) => {
  const effective = CONFIG.SEND_CRASH_REPORTS && userPrefEnabled;
  setCrashlyticsCollectionEnabled(getCrashlytics(), effective);
  getPerformance().dataCollectionEnabled = effective;
};

export default setCrashReportingCollectionEnabled;
