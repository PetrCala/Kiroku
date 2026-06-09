import type {DrinkLocation} from '@src/types/onyx';

const LOCATION_TIMEOUT_MS = 5000;

/**
 * Web sibling of getCurrentLocation. Native uses expo-location; the browser has
 * no such module, so we resolve the current fix through `navigator.geolocation`
 * instead. Returns a DrinkLocation, or null when geolocation is unavailable,
 * denied, or times out. Never rejects — the caller (a fire-and-forget capture
 * path) must not block on this.
 *
 * Unlike native, the browser owns the permission prompt: a prior
 * checkPermission('location') grant is not required and a denial simply yields
 * null here.
 */
function getCurrentLocation(): Promise<DrinkLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise<DrinkLocation | null>(resolve => {
    let settled = false;
    const settle = (value: DrinkLocation | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    // Guard the worst case where neither callback fires. getCurrentPosition's
    // own `timeout` covers the success/error path, but this mirrors the native
    // race so a hung lookup can never block the caller.
    setTimeout(() => settle(null), LOCATION_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      position => {
        const location: DrinkLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          capturedAt: position.timestamp ?? Date.now(),
        };
        // Only attach accuracy when the browser reported a number, mirroring
        // native: the server rejects writes containing `undefined`.
        if (typeof position.coords.accuracy === 'number') {
          location.accuracy = position.coords.accuracy;
        }
        settle(location);
      },
      () => settle(null),
      {enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0},
    );
  });
}

export default getCurrentLocation;
