// This module is retained only for the `FirebaseUpdates` type, still used by the
// remaining direct-RTDB write paths (`DrinkingSession.recomputeEarliestSessionAt`,
// `User`). The diff/merge helpers it used to export powered the legacy
// live-session screen sync, which now flows through the standard action pipeline
// (see `DrinkingSession.scheduleLiveSessionPersist`).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirebaseUpdates<T = any> = Record<string, T>;

// eslint-disable-next-line import/prefer-default-export
export type {FirebaseUpdates};
