/**
 * The credential payload JS hands to the native `WatchBridge` module, which
 * forwards it to the watch via `WCSession.updateApplicationContext`. Every
 * value must be plist-safe (no null/undefined properties); the ongoing session
 * travels as a JSON string and is decoded on the watch
 * (ios/Kiroku Watch App/Connectivity/SessionConnectivity.swift).
 */
type WatchCredentialPayload = {
  /** Firebase ID token the watch sends as its Bearer header */
  idToken: string;

  /** Firebase uid the token belongs to */
  uid: string;

  /** Token expiry as epoch milliseconds */
  expiresAt: number;

  /** Which kiroku-api backend this build talks to */
  apiEnv: 'dev' | 'prod';

  /** JSON string of the whitelisted ongoing-session fields; omitted when none */
  ongoingSession?: string;
};

/** The native module surface (ios/kiroku/WatchBridge.swift) */
type WatchBridgeModule = {
  updateCredential: (payload: WatchCredentialPayload) => void;
  clearCredential: () => void;
};

export type {WatchBridgeModule, WatchCredentialPayload};
