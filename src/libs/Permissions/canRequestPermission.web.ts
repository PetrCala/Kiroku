import type {PermissionKey} from './types';

/**
 * Web sibling of canRequestPermission: whether the browser would still prompt.
 *  - location → Permissions API state is 'prompt'. Without the API we can't
 *    tell, so assume it would prompt.
 *  - notifications → the Notification API's grant is still 'default'.
 *  - photo/camera → false: the web pickers prompt at use time.
 *
 * Never rejects.
 */
async function canRequestPermission(
  permissionType: PermissionKey,
): Promise<boolean> {
  if (permissionType === 'location') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return false;
    }
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({
          name: 'geolocation',
        });
        return status.state === 'prompt';
      }
    } catch {
      // Permissions API unsupported or threw; fall through.
    }
    return true;
  }

  if (permissionType === 'notifications') {
    return (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    );
  }

  return false;
}

export default canRequestPermission;
