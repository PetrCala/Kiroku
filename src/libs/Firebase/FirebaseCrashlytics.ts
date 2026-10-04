import type {CrashlyticsAttributes} from './FirebaseCrashlyticsTypes';

/**
 * Crashlytics is native-only, so this is a no-op on web, mirroring
 * `setCrashReportingCollectionEnabled` and `setCrashlyticsUserId`. Callers stay
 * platform-agnostic; on web an alert's console line is still its only record.
 */
function recordNonFatal(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _name: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _attributes: CrashlyticsAttributes = {},
): void {}

export default {recordNonFatal};
