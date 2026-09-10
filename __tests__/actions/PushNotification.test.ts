/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-in-views -- this is a test that asserts on the mocked API, not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- this is a test that asserts on the mocked Onyx.merge, not app code */

import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import Navigation from '@libs/Navigation/Navigation';
import PushNotification from '@libs/Notification/PushNotification';
import requestPermission from '@libs/Permissions/requestPermission';
import * as Preferences from '@userActions/Preferences';
import * as PushNotificationActions from '@userActions/PushNotification';
import ONYXKEYS from '@src/ONYXKEYS';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    merge: jest.fn(() => Promise.resolve()),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
}));

jest.mock('@libs/Notification/PushNotification', () => ({
  __esModule: true,
  default: {
    platform: 'ios',
    getPermissionStatus: jest.fn(() => Promise.resolve('granted')),
    requestPermission: jest.fn(() => Promise.resolve(true)),
    getToken: jest.fn(() => Promise.resolve('token-1')),
    deleteToken: jest.fn(() => Promise.resolve()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock('@libs/API', () => ({
  write: jest.fn(),
  makeRequestWithSideEffects: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: {uid: 'user-1'}}),
}));

jest.mock('@userActions/Device', () => ({
  getDeviceID: jest.fn(() => Promise.resolve('device-1')),
}));

jest.mock('@userActions/Preferences', () => ({
  updatePreferences: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/Localize/LocaleListener/BaseLocaleListener', () => ({
  __esModule: true,
  default: {getPreferredLocale: () => 'cs_cz'},
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {
    isNavigationReady: jest.fn(() => Promise.resolve()),
    navigate: jest.fn(),
  },
}));

jest.mock('@libs/Permissions/requestPermission', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {warn: jest.fn(), info: jest.fn()},
}));

const push = jest.mocked(PushNotification);
const mockedWrite = jest.mocked(API.write);
const mockedSideEffect = jest.mocked(API.makeRequestWithSideEffects);
const mockedMerge = jest.mocked(Onyx.merge);
const mockedNavigate = jest.mocked(Navigation.navigate);
const mockedRequestPermission = jest.mocked(requestPermission);
const mockedUpdatePreferences = jest.mocked(Preferences.updatePreferences);

/** Let chained promise callbacks run. */
const flushPromises = () =>
  new Promise(resolve => {
    setImmediate(resolve);
  });

function registerWrites() {
  return mockedWrite.mock.calls.filter(
    ([command]) => command === WRITE_COMMANDS.REGISTER_PUSH_DEVICE,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  push.getPermissionStatus.mockResolvedValue('granted');
  // Start every test from a clean "nothing registered" state.
  await PushNotificationActions.unregisterDevice(false);
  jest.clearAllMocks();
  push.getPermissionStatus.mockResolvedValue('granted');
});

describe('registerDevice', () => {
  it('registers the token, platform, device ID, and app locale', async () => {
    push.getToken.mockResolvedValue('token-a');
    await PushNotificationActions.registerDevice();
    expect(registerWrites()).toEqual([
      [
        WRITE_COMMANDS.REGISTER_PUSH_DEVICE,
        {
          token: 'token-a',
          platform: 'ios',
          deviceID: 'device-1',
          locale: 'cs_cz',
        },
      ],
    ]);
  });

  it('skips a repeat of the same token, but sends a rotated one', async () => {
    push.getToken.mockResolvedValue('token-b');
    await PushNotificationActions.registerDevice();
    await PushNotificationActions.registerDevice();
    expect(registerWrites()).toHaveLength(1);

    push.getToken.mockResolvedValue('token-c');
    await PushNotificationActions.registerDevice();
    expect(registerWrites()).toHaveLength(2);
    expect(registerWrites()[1][1]).toMatchObject({token: 'token-c'});
  });

  it('does nothing (and never prompts) without the OS permission', async () => {
    push.getPermissionStatus.mockResolvedValue('undetermined');
    await PushNotificationActions.registerDevice();
    expect(push.getToken).not.toHaveBeenCalled();
    expect(push.requestPermission).not.toHaveBeenCalled();
    expect(mockedWrite).not.toHaveBeenCalled();
  });
});

describe('unregisterDevice', () => {
  it('removes the device on the server and deletes the local token', async () => {
    await PushNotificationActions.unregisterDevice(true);
    expect(mockedSideEffect).toHaveBeenCalledWith(
      WRITE_COMMANDS.UNREGISTER_PUSH_DEVICE,
      {deviceID: 'device-1'},
    );
    expect(push.deleteToken).toHaveBeenCalledTimes(1);
  });

  it('only deletes the local token when the session is already gone', async () => {
    await PushNotificationActions.unregisterDevice(false);
    expect(mockedSideEffect).not.toHaveBeenCalled();
    expect(push.deleteToken).toHaveBeenCalledTimes(1);
  });

  it('lets the same token register again after signing out', async () => {
    push.getToken.mockResolvedValue('token-d');
    await PushNotificationActions.registerDevice();
    await PushNotificationActions.unregisterDevice(true);
    await PushNotificationActions.registerDevice();
    expect(registerWrites()).toHaveLength(2);
  });

  it('never rejects when the server call fails', async () => {
    mockedSideEffect.mockRejectedValueOnce(new Error('offline'));
    await expect(
      PushNotificationActions.unregisterDevice(true),
    ).resolves.toBeUndefined();
    expect(push.deleteToken).toHaveBeenCalled();
  });

  it('gives up waiting after the timeout so sign-out cannot hang', async () => {
    jest.useFakeTimers();
    try {
      mockedSideEffect.mockReturnValueOnce(new Promise(() => {}));
      let settled = false;
      const pending = PushNotificationActions.unregisterDevice(true).then(
        () => {
          settled = true;
        },
      );
      await jest.advanceTimersByTimeAsync(3000);
      await pending;
      expect(settled).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('soft ask', () => {
  it('queues the prompt when the OS permission was never asked for', async () => {
    push.getPermissionStatus.mockResolvedValue('undetermined');
    PushNotificationActions.requestPromptIfNeeded();
    await flushPromises();
    expect(mockedMerge).toHaveBeenCalledWith(
      ONYXKEYS.PUSH_NOTIFICATION_PROMPT,
      {shouldShow: true},
    );
  });

  it('never nags when the permission is blocked', async () => {
    push.getPermissionStatus.mockResolvedValue('blocked');
    PushNotificationActions.requestPromptIfNeeded();
    await flushPromises();
    expect(mockedMerge).not.toHaveBeenCalled();
  });

  it('registers instead of prompting when already granted', async () => {
    push.getToken.mockResolvedValue('token-e');
    PushNotificationActions.requestPromptIfNeeded();
    await flushPromises();
    expect(mockedMerge).not.toHaveBeenCalled();
    expect(registerWrites()).toHaveLength(1);
  });

  it('"Turn on" retires the prompt, asks the OS, and registers on grant', async () => {
    push.getToken.mockResolvedValue('token-f');
    await PushNotificationActions.answerPrompt(true);
    expect(mockedMerge).toHaveBeenCalledWith(
      ONYXKEYS.PUSH_NOTIFICATION_PROMPT,
      {shouldShow: false, hasBeenShown: true},
    );
    expect(push.requestPermission).toHaveBeenCalledTimes(1);
    expect(registerWrites()).toHaveLength(1);
  });

  it('"Not now" retires the prompt without the system dialog', async () => {
    await PushNotificationActions.answerPrompt(false);
    expect(mockedMerge).toHaveBeenCalledWith(
      ONYXKEYS.PUSH_NOTIFICATION_PROMPT,
      {shouldShow: false, hasBeenShown: true},
    );
    expect(push.requestPermission).not.toHaveBeenCalled();
  });
});

describe('preferences', () => {
  it('enabling asks for the permission first, then saves and registers', async () => {
    push.getPermissionStatus.mockResolvedValue('undetermined');
    mockedRequestPermission.mockResolvedValueOnce(true);
    await expect(
      PushNotificationActions.enablePushNotifications(),
    ).resolves.toBe(true);
    expect(mockedRequestPermission).toHaveBeenCalledWith('notifications');
    expect(mockedUpdatePreferences).toHaveBeenCalledWith({
      push_notifications_enabled: true,
    });
  });

  it('a denied permission leaves the preference untouched', async () => {
    push.getPermissionStatus.mockResolvedValue('blocked');
    mockedRequestPermission.mockResolvedValueOnce(false);
    await expect(
      PushNotificationActions.enablePushNotifications(),
    ).resolves.toBe(false);
    expect(mockedUpdatePreferences).not.toHaveBeenCalled();
  });

  it('saves the global and friend-request switches', () => {
    PushNotificationActions.setPushNotificationsEnabled(false);
    PushNotificationActions.setFriendRequestNotificationsEnabled(false);
    expect(mockedUpdatePreferences).toHaveBeenCalledWith({
      push_notifications_enabled: false,
    });
    expect(mockedUpdatePreferences).toHaveBeenCalledWith({
      push_friend_requests_enabled: false,
    });
  });
});

describe('opening a notification', () => {
  it('navigates to the deep link', async () => {
    PushNotificationActions.openNotification({path: 'social/friend-requests'});
    await flushPromises();
    expect(mockedNavigate).toHaveBeenCalledWith('social/friend-requests');
  });

  it.each([
    ['no path', undefined],
    ['a URL', 'https://example.com/x'],
    ['a relative escape', '../settings'],
    ['a leading slash', '/profile/x'],
  ])('ignores %s', async (_label, path) => {
    PushNotificationActions.openNotification({path});
    await flushPromises();
    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  it('opens the launch notification only once per process', async () => {
    push.getInitialNotification.mockResolvedValue({
      path: 'profile/user-2',
    });
    PushNotificationActions.openInitialNotification();
    PushNotificationActions.openInitialNotification();
    await flushPromises();
    expect(push.getInitialNotification).toHaveBeenCalledTimes(1);
    expect(mockedNavigate).toHaveBeenCalledWith('profile/user-2');
  });
});
