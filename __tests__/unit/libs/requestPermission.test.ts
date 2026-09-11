/**
 * Tests for the native permission request helper
 * (src/libs/Permissions/requestPermission.ts). react-native-permissions is
 * mocked in __mocks__/react-native-permissions.ts; getPlatform is pinned to iOS
 * and react-native is reduced to the surface the helper touches.
 */
import {Alert} from 'react-native';
import {RESULTS, requestNotifications} from 'react-native-permissions';
import requestPermission from '@libs/Permissions/requestPermission';

jest.mock('react-native', () => ({
  Alert: {alert: jest.fn()},
  Linking: {openSettings: jest.fn()},
  Platform: {OS: 'ios', Version: '18.0'},
  PermissionsAndroid: {
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    PERMISSIONS: {
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
  },
}));

jest.mock('@src/CONST', () => ({
  PLATFORM: {IOS: 'ios', ANDROID: 'android', WEB: 'web'},
}));

jest.mock('@libs/getPlatform', () => ({
  __esModule: true,
  default: jest.fn(() => 'ios'),
}));

jest.mock('@libs/Localize', () => ({
  translateLocal: jest.fn((key: string) => key),
}));

const mockAlert = Alert.alert as jest.Mock;
const mockRequestNotifications = requestNotifications as jest.Mock;

describe('requestPermission on iOS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves true and shows no alert when notifications are granted', async () => {
    await expect(requestPermission('notifications')).resolves.toBe(true);

    expect(mockRequestNotifications).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('resolves false and explains the denial when notifications are blocked', async () => {
    mockRequestNotifications.mockImplementationOnce(() => ({
      status: RESULTS.BLOCKED,
      settings: {},
    }));

    await expect(requestPermission('notifications')).resolves.toBe(false);

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0]?.[0]).toBe('permissions.permissionDenied');
  });
});
