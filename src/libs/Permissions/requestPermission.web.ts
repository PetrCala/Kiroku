import type {PermissionKey} from './types';

const LOCATION_REQUEST_TIMEOUT_MS = 10000;

/**
 * Trigger the browser's geolocation prompt and resolve to whether access was
 * granted. A successful fix means granted; an error (including the user denying
 * the prompt) means not granted.
 */
function requestLocationPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(false);
  }
  return new Promise<boolean>(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      {timeout: LOCATION_REQUEST_TIMEOUT_MS, maximumAge: 0},
    );
  });
}

/**
 * Web sibling of requestPermission. react-native-permissions has no web build,
 * so we trigger the matching browser prompt and resolve to whether access was
 * granted:
 *  - location → navigator.geolocation (browser shows the prompt).
 *  - notifications → Notification.requestPermission().
 *  - photo/camera reads → true: the web pickers prompt at use time, so an
 *    explicit request step is a no-op grant here.
 *
 * Never rejects. Unlike the native sibling it shows no fallback Alert: the
 * browser surfaces its own denial UI.
 */
async function requestPermission(
  permissionType: PermissionKey,
): Promise<boolean> {
  if (permissionType === 'location') {
    return requestLocationPermission();
  }

  if (permissionType === 'notifications') {
    if (typeof Notification === 'undefined') {
      return false;
    }
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  return true;
}

export default requestPermission;
