import type {Permission, Rationale, PermissionStatus} from 'react-native';
import {Alert, Platform, PermissionsAndroid, Linking} from 'react-native';
import type {
  Permission as RNPermission,
  PermissionStatus as RNPermissionStatus,
  NotificationsResponse,
} from 'react-native-permissions';
import {request, requestNotifications} from 'react-native-permissions';
import getPlatform from '@libs/getPlatform';
import CONST from '@src/CONST';
import * as Localize from '@libs/Localize';
import {
  AndroidFilePermissions,
  permissionIsDenied,
  permissionIsGranted,
} from './PermissionsUtils';
import permissionsMap from './PermissionsMap';
import permissionsMessages from './PermissionsMessages';
import type {
  GeneralPermissionStatus,
  PermissionKey,
  PermissionValue,
} from './types';

const openSettings = () => {
  Linking.openSettings();
};

/**
 * Android permission check to store/read images
 */
async function hasAndroidFilePermission(): Promise<boolean> {
  // On Android API Level 33 and above, these permissions do nothing and always return 'never_ask_again'
  // More info here: https://stackoverflow.com/a/74296799
  if (Number(Platform.Version) >= 33) {
    return Promise.resolve(true);
  }

  // Read and write permission
  const writePromise = PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  const readPromise = PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  );

  return Promise.all([writePromise, readPromise]).then(
    ([hasWritePermission, hasReadPermission]) => {
      if (hasWritePermission && hasReadPermission) {
        return true; // Return true if permission is already given
      }

      // Ask for permission if not given
      return PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]).then(
        status =>
          status['android.permission.READ_EXTERNAL_STORAGE'] === 'granted' &&
          status['android.permission.WRITE_EXTERNAL_STORAGE'] === 'granted',
      );
    },
  );
}

const requestPermissionAndroid = async (
  permission: Permission,
  permissionType: PermissionKey,
): Promise<PermissionStatus> => {
  try {
    // Handle android file permissions separately
    if (AndroidFilePermissions.includes(permission)) {
      const hasPermission = await hasAndroidFilePermission();
      if (hasPermission) {
        return PermissionsAndroid.RESULTS.GRANTED;
      }
      return PermissionsAndroid.RESULTS.DENIED;
    }
    const rationale: Rationale = {
      title: permissionsMessages[permissionType].title,
      message: permissionsMessages[permissionType].message,
      buttonNeutral: Localize.translateLocal('common.askMeLater'),
      buttonNegative: Localize.translateLocal('common.cancel'),
      buttonPositive: Localize.translateLocal('common.ok'),
    };
    // const status = await PermissionsAndroid.request(permission, rationale);
    const status = await PermissionsAndroid.request(permission, rationale);
    return status; // status === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    return PermissionsAndroid.RESULTS.DENIED;
  }
};

const requestPermissionIOS = async (
  permission: RNPermission,
): Promise<RNPermissionStatus> => {
  const status = await request(permission);
  return status; // status === RESULTS.GRANTED;
};

const requestNotificationsPermissionIOS =
  async (): Promise<NotificationsResponse> => {
    const response = await requestNotifications(['alert', 'sound']);
    return response; // response.status === RESULTS.GRANTED;
  };

/**
 * Requests a specific permission.
 * @param permissionType - The type of permission to request.
 * @returns A promise that resolves to a boolean indicating whether the permission was granted.
 */
const requestPermission = async (permissionType: PermissionKey) => {
  const currentPlatform = getPlatform();
  const permission: PermissionValue | undefined =
    permissionsMap[permissionType][currentPlatform];

  const isAndroid = currentPlatform === CONST.PLATFORM.ANDROID;
  const isIOS = currentPlatform === CONST.PLATFORM.IOS;

  let status: GeneralPermissionStatus = 'unavailable';

  if (isAndroid) {
    status = await requestPermissionAndroid(
      permission as Permission,
      permissionType,
    );
  } else if (isIOS && permissionType === 'notifications') {
    status = await requestNotificationsPermissionIOS();
  } else if (isIOS) {
    status = await requestPermissionIOS(permission as RNPermission);
  }

  const isGranted = permissionIsGranted(status);

  if (!isGranted) {
    const restrictedAccess = permissionIsDenied(status);
    if (restrictedAccess) {
      Alert.alert(
        Localize.translateLocal('permissions.permissionDenied'),
        Localize.translateLocal('permissions.appNeedsAccess'),
        [
          {text: Localize.translateLocal('common.cancel'), style: 'cancel'},
          {
            text: Localize.translateLocal('permissions.openSettings'),
            onPress: openSettings,
          },
        ],
      );
    } else {
      Alert.alert(
        Localize.translateLocal('permissions.permissionDenied'),
        Localize.translateLocal('permissions.youNeedToGrantPermission'),
      );
    }
  }

  return isGranted;
};

export default requestPermission;
