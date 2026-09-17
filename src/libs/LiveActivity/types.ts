import type {NativeModule} from 'react-native';

/**
 * The payload JS hands to the native live-session surface: the iOS Live
 * Activity (`ios/kiroku/LiveActivityBridge.swift`) and, from W4 step 3, the
 * Android ongoing notification. One shape for both, because one hook drives
 * both.
 *
 * Every value must be plist-safe (no null, no undefined properties). Text is
 * already localized here, because neither native surface can reach
 * `src/languages`. The elapsed time is deliberately absent: both platforms
 * render it natively from `startedAt`, so it keeps ticking while the app is
 * suspended and no JS-driven clock string is ever sent.
 */
type LiveSessionActivityPayload = {
  /** The ongoing session this surface belongs to */
  sessionId: string;

  /** When the session started, epoch milliseconds; the timer counts from here */
  startedAt: number;

  /** Where a tap goes (`kiroku://drinking-session/<id>/live`) */
  deepLink: string;

  /** The session name (W1 `SessionMeta.name`), localized default included */
  name: string;

  /** The unit total, already formatted, e.g. "4.5 units" */
  unitsText: string;

  /** How many drinks the session holds */
  drinkCount: number;

  /** Localized label for that count, e.g. "Drinks" */
  drinksLabel: string;

  /**
   * Localized name for the Android notification channel, so a user reading
   * their system notification settings sees it in their own language. Android
   * only; iOS has no channels and ignores it.
   */
  channelName: string;

  /**
   * When the server's stale-session sweep becomes entitled to close this
   * session, epoch milliseconds, or absent when nothing will close it. Android
   * turns it into `setTimeoutAfter`, so an ongoing notification cannot outlive
   * a session that was auto-closed while the app was not running. iOS ignores
   * it: an activity there is ended by the app or by the system's own budget.
   */
  autoCloseAt?: number;

  /**
   * When the session closed, epoch milliseconds. Only set on `end`, where it
   * freezes the timer so the last frame reads as a summary.
   */
  endedAt?: number;
};

/**
 * An ActivityKit push token, as the running Live Activity's APNs address.
 * iOS mints one per activity and may rotate it while the activity runs, so it
 * arrives asynchronously rather than as a return value.
 */
type LiveActivityPushToken = {
  /** The session whose activity this token addresses */
  sessionId: string;

  /** The APNs token, lowercase hex */
  token: string;
};

/**
 * The native module surface. Fire and forget on the way down: nothing
 * resolves, nothing rejects, and every reason not to show anything (an OS
 * without ActivityKit, activities turned off, notifications denied) is handled
 * natively rather than being reported back here.
 */
type LiveActivityModule = {
  /** A session went live */
  start: (payload: LiveSessionActivityPayload) => void;

  /** Something in the live session changed */
  update: (payload: LiveSessionActivityPayload) => void;

  /** The session closed, or there is no longer one to show */
  end: (payload: LiveSessionActivityPayload) => void;

  /**
   * Listen for the running activity's push token. iOS only: Android's ongoing
   * notification is local and has nothing to address. Returns an unsubscribe.
   */
  subscribeToPushToken?: (
    listener: (pushToken: LiveActivityPushToken) => void,
  ) => () => void;
};

/**
 * The iOS bridge as React Native sees it: the module plus the `addListener` /
 * `removeListeners` pair every `RCTEventEmitter` exports, which
 * `NativeEventEmitter` requires.
 */
type LiveActivityNativeModule = LiveActivityModule & NativeModule;

export type {
  LiveActivityModule,
  LiveActivityNativeModule,
  LiveActivityPushToken,
  LiveSessionActivityPayload,
};
