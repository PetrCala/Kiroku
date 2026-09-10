import type {PushNotificationModule} from './types';

const noopUnsubscribe = () => {};

/**
 * Web has no push support yet (web push is a follow-up), so every call is a
 * no-op and the permission reads as `unavailable`. Notification preferences
 * still render on web: they apply to the user's mobile devices.
 */
const PushNotification: PushNotificationModule = {
  platform: undefined,
  getPermissionStatus: () => Promise.resolve('unavailable'),
  requestPermission: () => Promise.resolve(false),
  getToken: () => Promise.resolve(null),
  deleteToken: () => Promise.resolve(),
  onTokenRefresh: () => noopUnsubscribe,
  onForegroundMessage: () => noopUnsubscribe,
  onNotificationOpened: () => noopUnsubscribe,
  getInitialNotification: () => Promise.resolve(null),
  registerBackgroundHandler: () => {},
};

export default PushNotification;
