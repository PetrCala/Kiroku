// REMOVED: import crashlytics from '@react-native-firebase/crashlytics';
// Crashlytics temporarily disabled - module removed from dependencies
import Log from '@libs/Log';

/**
 * No-op stub for Crashlytics user ID setting
 * TODO: Re-enable when Crashlytics is restored
 */
const setCrashlyticsUserId = (accountID: string | number) => {
  // No-op: Crashlytics module removed
  if (!__DEV__) {
    return;
  }
  Log.info(`[Crashlytics] Would set user ID: ${accountID}`);
};

export default setCrashlyticsUserId;
