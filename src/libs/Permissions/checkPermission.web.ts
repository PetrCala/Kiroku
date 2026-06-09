import type {PermissionKey} from './types';

/**
 * Web sibling of checkPermission. react-native-permissions has no web build, so
 * we answer from the browser's own permission surfaces instead:
 *  - location → the Permissions API (`navigator.permissions`) when available.
 *  - notifications → the Notification API's current grant.
 *  - photo/camera reads → always granted: the web pickers (`<input type=file>`,
 *    getUserMedia) drive their own prompts at use time, so there is nothing to
 *    pre-check.
 *
 * Never rejects; an unsupported API resolves to false. Because nothing here
 * imports react-native-permissions, the web bundle drops the native module
 * entirely.
 */
async function checkPermission(
  permissionType: PermissionKey,
): Promise<boolean> {
  if (permissionType === 'location') {
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const status = await navigator.permissions.query({
          name: 'geolocation',
        });
        return status.state === 'granted';
      }
    } catch {
      // Permissions API unsupported or threw — treat as not granted.
    }
    return false;
  }

  if (permissionType === 'notifications') {
    return (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    );
  }

  // read_photos / write_photos / camera: the browser prompts inline when the
  // picker is opened, so there is no separate grant to verify here.
  return true;
}

export default checkPermission;
