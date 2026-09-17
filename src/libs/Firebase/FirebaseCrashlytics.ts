import type {CrashlyticsAttributes} from './FirebaseCrashlyticsTypes';

/**
 * Crashlytics is native-only, so this is a no-op on web, mirroring
 * `setCrashReportingCollectionEnabled` and `setCrashlyticsUserId`. Callers stay
 * platform-agnostic; on web the matching `Log.alert` is still the only record.
 */
function recordNonFatal(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _name: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _attributes: CrashlyticsAttributes = {},
): void {}

export default {recordNonFatal};
