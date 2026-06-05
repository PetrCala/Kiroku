import {useEffect} from 'react';
import {useOnyx} from 'react-native-onyx';
import setCrashReportingCollectionEnabled from '@libs/setCrashReportingCollectionEnabled';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Applies the crash-reporting opt-out from the user's preferences (server is the
 * source of truth via `app/open`, so it survives reinstall) to the native
 * collectors. Absent ⇒ enabled (the legitimate-interest opt-out default); gating
 * against the build flag and the web no-op live in the util. Crashlytics persists
 * this across restarts. Renders nothing — mounted alongside the authenticated app.
 */
function CrashReportingSync() {
  const [preferences] = useOnyx(ONYXKEYS.PREFERENCES);

  useEffect(() => {
    if (preferences === undefined) {
      return;
    }
    setCrashReportingCollectionEnabled(
      preferences.crash_reporting_enabled !== false,
    );
  }, [preferences]);

  return null;
}

CrashReportingSync.displayName = 'CrashReportingSync';

export default CrashReportingSync;
