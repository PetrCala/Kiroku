import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import BaseLocaleListener from '@libs/Localize/LocaleListener/BaseLocaleListener';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import PushNotification from '@libs/Notification/PushNotification';
import type {PushNotificationMessage} from '@libs/Notification/PushNotification/types';
import requestPermission from '@libs/Permissions/requestPermission';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import * as Device from './Device';
import * as Preferences from './Preferences';

/**
 * Push notifications: the device registry on kiroku-api, the one-time soft
 * ask for the OS permission, the account-wide preferences, and opening a
 * tapped notification's deep link.
 *
 * Every entry point is a no-op where push isn't supported
 * (`PushNotification.platform` is undefined on web).
 */

/** Sign-out waits at most this long for the unregister before moving on. */
const UNREGISTER_TIMEOUT_MS = 3000;

/**
 * A notification's `path` must be a plain relative app route
 * (`social/friend-requests`, `profile/<uid>`): no scheme, no dots, no leading
 * slash. Anything else is ignored rather than handed to the router.
 */
const NOTIFICATION_PATH_PATTERN = /^[a-z0-9][a-z0-9/_-]*$/i;

/** The in-flight unregister, so concurrent sign-outs share one. */
let pendingUnregister: Promise<void> | undefined;

/** The launch notification is opened once per process, not on every sign-in. */
let hasOpenedInitialNotification = false;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Register (or refresh) this device's FCM token with kiroku-api. Does nothing
 * until the OS permission is granted, so it never prompts. Queued like any
 * write, so it survives being offline. Every call sends: the server write is an
 * idempotent refresh, and skipping "already sent" repeats would also skip the
 * retry after a registration the server rejected (the queue drops a 4xx).
 */
async function registerDevice(): Promise<void> {
  const platform = PushNotification.platform;
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!platform || !uid) {
    return;
  }
  try {
    if ((await PushNotification.getPermissionStatus()) !== 'granted') {
      return;
    }
    const [token, deviceID] = await Promise.all([
      PushNotification.getToken(),
      Device.getDeviceID(),
    ]);
    if (!token || !deviceID) {
      return;
    }
    API.write(WRITE_COMMANDS.REGISTER_PUSH_DEVICE, {
      token,
      // Not `platform`: enhanceParameters overwrites that key with the legacy
      // "iOS"/"Android" value and HttpUtils strips it from kiroku-api bodies.
      devicePlatform: platform,
      deviceID,
      locale: BaseLocaleListener.getPreferredLocale(),
    });
  } catch (error) {
    Log.warn(
      `[PushNotification] Could not register this device: ${errorMessage(error)}`,
    );
  }
}

/**
 * Unregister this device on sign-out: remove it on kiroku-api (when
 * `shouldNotifyServer`, i.e. the Firebase session is still valid) and delete
 * the local FCM token, so even a server call that never lands leaves a dead
 * token the server prunes on its next send.
 *
 * Bounded by UNREGISTER_TIMEOUT_MS and never rejects: sign-out must not hang
 * on it or fail because of it.
 */
function unregisterDevice(shouldNotifyServer: boolean): Promise<void> {
  if (!PushNotification.platform) {
    return Promise.resolve();
  }
  if (pendingUnregister) {
    return pendingUnregister;
  }

  const notifyServer = shouldNotifyServer
    ? Device.getDeviceID().then(deviceID =>
        deviceID
          ? // Direct, not queued: sign-out clears the persisted queue and drops
            // the ID token this call needs, so a queued write would never run.
            // eslint-disable-next-line rulesdir/no-api-side-effects-method
            API.makeRequestWithSideEffects(
              WRITE_COMMANDS.UNREGISTER_PUSH_DEVICE,
              {deviceID},
            )
          : undefined,
      )
    : Promise.resolve();

  const work = Promise.all([notifyServer, PushNotification.deleteToken()])
    .then(() => undefined)
    .catch((error: unknown) => {
      Log.warn(
        `[PushNotification] Could not unregister this device: ${errorMessage(error)}`,
      );
    });

  let timeoutID: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>(resolve => {
    timeoutID = setTimeout(resolve, UNREGISTER_TIMEOUT_MS);
  });

  pendingUnregister = Promise.race([work, timeout]).finally(() => {
    clearTimeout(timeoutID);
    pendingUnregister = undefined;
  });
  return pendingUnregister;
}

/**
 * Called after the user sends a friend request. If the OS permission was
 * never asked for, queue the soft ask (rendered by PushNotificationPrompt,
 * which shows it at most once). If it's already granted, make sure this
 * device is registered.
 */
function requestPromptIfNeeded(): void {
  if (!PushNotification.platform) {
    return;
  }
  PushNotification.getPermissionStatus()
    .then(status => {
      if (status === 'granted') {
        return registerDevice();
      }
      if (status === 'undetermined') {
        return Onyx.merge(ONYXKEYS.PUSH_NOTIFICATION_PROMPT, {
          shouldShow: true,
        });
      }
      return undefined;
    })
    .catch(() => undefined);
}

/**
 * The user answered the soft ask. Either way it's never shown again; on yes,
 * show the system prompt and register once granted.
 */
function answerPrompt(accepted: boolean): Promise<void> {
  Onyx.merge(ONYXKEYS.PUSH_NOTIFICATION_PROMPT, {
    shouldShow: false,
    hasBeenShown: true,
  });
  if (!accepted) {
    return Promise.resolve();
  }
  return PushNotification.requestPermission()
    .then(granted => (granted ? registerDevice() : undefined))
    .catch(() => undefined);
}

/** Save the account-wide push switch (kiroku-api checks it before every send). */
function setPushNotificationsEnabled(enabled: boolean): void {
  Preferences.updatePreferences({push_notifications_enabled: enabled});
}

/** Save the friend-request notifications switch. */
function setFriendRequestNotificationsEnabled(enabled: boolean): void {
  Preferences.updatePreferences({push_friend_requests_enabled: enabled});
}

/**
 * Turn push on from Settings. On devices with push, asks for the OS permission
 * when it isn't granted yet (the permission helper explains a denial and
 * offers the system settings); only then saves the preference and registers.
 * Resolves to whether push ended up on.
 */
async function enablePushNotifications(): Promise<boolean> {
  try {
    if (PushNotification.platform) {
      const status = await PushNotification.getPermissionStatus();
      const isGranted =
        status === 'granted' || (await requestPermission('notifications'));
      if (!isGranted) {
        return false;
      }
    }
    setPushNotificationsEnabled(true);
    await registerDevice();
    return true;
  } catch (error) {
    Log.warn(
      `[PushNotification] Could not enable notifications: ${errorMessage(error)}`,
    );
    return false;
  }
}

/** The app route a notification points at, or undefined when it has none or it isn't a plain route. */
function getNotificationRoute(
  message: PushNotificationMessage,
): Route | undefined {
  const path = message.path;
  if (!path || !NOTIFICATION_PATH_PATTERN.test(path)) {
    return undefined;
  }
  return path as Route;
}

/** Navigate to a tapped notification's deep link through the linking config. */
function openNotification(message: PushNotificationMessage): void {
  const route = getNotificationRoute(message);
  if (!route) {
    return;
  }
  Navigation.isNavigationReady().then(() => Navigation.navigate(route));
}

/** Open the notification that launched the app from a quit state, once per process. */
function openInitialNotification(): void {
  if (hasOpenedInitialNotification || !PushNotification.platform) {
    return;
  }
  hasOpenedInitialNotification = true;
  PushNotification.getInitialNotification()
    .then(message => {
      if (message) {
        openNotification(message);
      }
    })
    .catch(() => undefined);
}

export {
  registerDevice,
  unregisterDevice,
  requestPromptIfNeeded,
  answerPrompt,
  setPushNotificationsEnabled,
  setFriendRequestNotificationsEnabled,
  enablePushNotifications,
  getNotificationRoute,
  openNotification,
  openInitialNotification,
};
