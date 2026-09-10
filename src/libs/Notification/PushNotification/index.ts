import {
  deleteToken as fcmDeleteToken,
  getInitialNotification as fcmGetInitialNotification,
  getMessaging,
  getToken as fcmGetToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh as fcmOnTokenRefresh,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import {
  checkNotifications,
  requestNotifications,
  RESULTS,
} from 'react-native-permissions';
import getPlatform from '@libs/getPlatform';
import CONST from '@src/CONST';
import type {
  PushNotificationMessage,
  PushNotificationModule,
  PushPermissionStatus,
} from './types';

/**
 * Native (iOS + Android) push over Firebase Cloud Messaging. The web build
 * resolves `index.web.ts` instead, which supports nothing.
 *
 * Permission goes through react-native-permissions rather than FCM's own
 * `requestPermission`, because it tells "never asked" apart from "denied" on
 * Android 13+ too (POST_NOTIFICATIONS), which the soft ask depends on.
 */

type RemoteMessage = Parameters<Parameters<typeof onMessage>[1]>[0];

function toMessage(remote: RemoteMessage): PushNotificationMessage {
  const data = remote.data ?? {};
  return {
    title: remote.notification?.title,
    body: remote.notification?.body,
    path: typeof data.path === 'string' ? data.path : undefined,
    type: typeof data.type === 'string' ? data.type : undefined,
  };
}

function toPermissionStatus(status: string): PushPermissionStatus {
  switch (status) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      // react-native-permissions' "denied" means "not asked yet, requestable".
      return 'undetermined';
    case RESULTS.BLOCKED:
      return 'blocked';
    default:
      return 'unavailable';
  }
}

const PushNotification: PushNotificationModule = {
  platform: getPlatform() === CONST.PLATFORM.IOS ? 'ios' : 'android',

  getPermissionStatus: () =>
    checkNotifications().then(({status}) => toPermissionStatus(status)),

  requestPermission: () =>
    requestNotifications(['alert', 'badge', 'sound']).then(
      ({status}) => toPermissionStatus(status) === 'granted',
    ),

  getToken: () => fcmGetToken(getMessaging()).then(token => token || null),

  deleteToken: () => fcmDeleteToken(getMessaging()),

  onTokenRefresh: callback => fcmOnTokenRefresh(getMessaging(), callback),

  onForegroundMessage: callback =>
    onMessage(getMessaging(), remote => callback(toMessage(remote))),

  onNotificationOpened: callback =>
    onNotificationOpenedApp(getMessaging(), remote =>
      callback(toMessage(remote)),
    ),

  getInitialNotification: () =>
    fcmGetInitialNotification(getMessaging()).then(remote =>
      remote ? toMessage(remote) : null,
    ),

  registerBackgroundHandler: () => {
    // kiroku-api sends notification messages, which the system displays by
    // itself while the app is backgrounded or quit, so there is no headless
    // work. Registering a handler keeps FCM from warning that none is set.
    setBackgroundMessageHandler(getMessaging(), () => Promise.resolve());
  },
};

export default PushNotification;
