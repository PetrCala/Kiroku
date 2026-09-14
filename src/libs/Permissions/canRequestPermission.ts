import {check, checkNotifications, RESULTS} from 'react-native-permissions';
import type {Permission} from 'react-native-permissions';
import getPlatform from '@libs/getPlatform';
import CONST from '@src/CONST';
import permissionsMap from './PermissionsMap';
import type {PermissionKey} from './types';

/**
 * Whether requesting this permission would show the OS permission dialog, i.e.
 * the user hasn't answered it yet. `RESULTS.DENIED` means "not determined" on
 * iOS and "requestable" on Android; an answered or unavailable permission
 * resolves to false.
 *
 * Use it to gate a pre-permission explainer: App Review requires the explainer
 * to always lead to the system dialog, so it must not show when none follows.
 */
async function canRequestPermission(
  permissionType: PermissionKey,
): Promise<boolean> {
  const platform = getPlatform();
  if (permissionType === 'notifications' && platform === CONST.PLATFORM.IOS) {
    const {status} = await checkNotifications();
    return status === RESULTS.DENIED;
  }

  const permission = permissionsMap[permissionType][platform];
  if (!permission) {
    return false;
  }
  const status = await check(permission as Permission);
  return status === RESULTS.DENIED;
}

export default canRequestPermission;
