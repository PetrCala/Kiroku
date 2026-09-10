/** The parts of a received push the app acts on. */
type PushNotificationMessage = {
  /** Notification title, as shown by the system */
  title?: string;

  /** Notification body, as shown by the system */
  body?: string;

  /** App route to open on tap (kiroku-api's `data.path`, e.g. `social/friend-requests`) */
  path?: string;

  /** Notification type (kiroku-api's `data.type`, e.g. `friend_request_received`) */
  type?: string;
};

/**
 * OS notification permission, normalized across platforms:
 *  - `undetermined`: never asked, the system prompt can still be shown
 *  - `blocked`: denied, only the system settings can change it
 *  - `unavailable`: the platform has no push support here (web)
 */
type PushPermissionStatus =
  | 'granted'
  | 'undetermined'
  | 'blocked'
  | 'unavailable';

type PushPlatform = 'ios' | 'android';

type PushNotificationModule = {
  /** The platform kiroku-api registers this device under, or undefined where push is unsupported */
  platform: PushPlatform | undefined;

  /** Current OS permission, without prompting */
  getPermissionStatus: () => Promise<PushPermissionStatus>;

  /** Show the system permission prompt (no-op when already decided). Resolves to whether it's granted. */
  requestPermission: () => Promise<boolean>;

  /** This install's FCM token, or null when unavailable */
  getToken: () => Promise<string | null>;

  /** Invalidate this install's FCM token (sign-out). A new one is minted on the next getToken. */
  deleteToken: () => Promise<void>;

  /** Called when FCM rotates the token. Returns an unsubscribe function. */
  onTokenRefresh: (callback: (token: string) => void) => () => void;

  /** Called for pushes received while the app is in the foreground (the system shows nothing). */
  onForegroundMessage: (
    callback: (message: PushNotificationMessage) => void,
  ) => () => void;

  /** Called when the user taps a notification while the app is in the background. */
  onNotificationOpened: (
    callback: (message: PushNotificationMessage) => void,
  ) => () => void;

  /** The notification whose tap launched the app from a quit state, if any. */
  getInitialNotification: () => Promise<PushNotificationMessage | null>;

  /** Register the headless handler. Must run at startup, outside React (index.js). */
  registerBackgroundHandler: () => void;
};

export type {
  PushNotificationMessage,
  PushPermissionStatus,
  PushPlatform,
  PushNotificationModule,
};
