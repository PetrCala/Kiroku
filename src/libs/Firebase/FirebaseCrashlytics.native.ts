import {
  getCrashlytics,
  log,
  recordError,
  setAttributes,
} from '@react-native-firebase/crashlytics';
import CONFIG from '@src/CONFIG';
import type {CrashlyticsAttributes} from './FirebaseCrashlyticsTypes';

/**
 * Record a non-fatal event named `name`, with `attributes` attached as custom keys.
 *
 * `Log.alert` has no production sink in this fork: `LogCommand` in `libs/Log.ts` is
 * a stub that resolves without posting, and the client callback only reaches
 * `console.debug` plus opt-in Onyx log collection. Crashlytics is the one sink that
 * works in a release build, so anything that must be visible in the field goes
 * through here in addition to `Log.alert`.
 *
 * Collection is gated twice: by the `SEND_CRASH_REPORTS` build flag below, and by
 * the user's own preference inside the SDK (see `setCrashReportingCollectionEnabled`),
 * which makes these calls no-ops when the user has opted out. The body is wrapped so
 * reporting can never break the caller.
 */
function recordNonFatal(
  name: string,
  attributes: CrashlyticsAttributes = {},
): void {
  if (!CONFIG.SEND_CRASH_REPORTS) {
    return;
  }
  try {
    const crashlytics = getCrashlytics();
    const customKeys: Record<string, string> = {};
    Object.entries(attributes).forEach(([key, value]) => {
      customKeys[key] = String(value);
    });
    setAttributes(crashlytics, customKeys);
    log(crashlytics, name);
    // A non-fatal needs an Error to group by. Passing `name` as the jsErrorName
    // keeps every occurrence in one issue instead of grouping on the JS stack,
    // which differs per build.
    recordError(crashlytics, new Error(name), name);
  } catch {
    // Never let crash reporting itself break the caller.
  }
}

export default {recordNonFatal};
