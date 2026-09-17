/**
 * Custom-key values accepted by `FirebaseCrashlytics.recordNonFatal`. Crashlytics
 * custom keys are strings on the wire, so every value is stringified before it is
 * sent; the union just keeps callers from passing objects that stringify to
 * `[object Object]`.
 */
type CrashlyticsAttributes = Record<
  string,
  string | number | boolean | null | undefined
>;

export type {
  // eslint-disable-next-line import/prefer-default-export
  CrashlyticsAttributes,
};
