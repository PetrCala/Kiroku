// SinglePermissionHandler.js
import {Platform} from 'react-native';
import {check, RESULTS, checkNotifications} from 'react-native-permissions';
import {PermissionKey, permissionIsGranted} from './PermissionsUtils';
import permissionsMap from './PermissionsMap';

const getPermission = (permissionType: PermissionKey) => {
  return permissionsMap[permissionType][Platform.OS];
};

const checkGeneralPermission = async (
  permissionType: PermissionKey,
): Promise<boolean> => {
  const status = await check(getPermission(permissionType));
  return permissionIsGranted(status);
};

const checkNotificationPermission = async (): Promise<boolean> => {
  const {status} = await checkNotifications();
  return permissionIsGranted(status);
};

/**
 * Checks the permission for the specified permission type.
 * @param permissionType - The type of permission to check.
 * @returns A promise that resolves to a boolean indicating whether the permission is granted or not.
 */
const checkPermission = async (
  permissionType: PermissionKey,
): Promise<boolean> => {
  let result: boolean;
  if (permissionType === 'notifications' && Platform.OS === 'ios') {
    result = await checkNotificationPermission();
  } else {
    result = await checkGeneralPermission(permissionType);
  }
  return result;
};

export default checkPermission;
