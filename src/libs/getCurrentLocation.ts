import * as Location from 'expo-location';
import type {DrinkLocation} from '@src/types/onyx';

const LOCATION_TIMEOUT_MS = 5000;

/**
 * Resolve the device's current GPS fix as a DrinkLocation, or null if the OS
 * timed out, denied access at the call site, or threw. Never rejects — the
 * caller (a fire-and-forget capture path) must not block on this.
 *
 * Caller must have already verified permission via checkPermission('location');
 * this util does not re-check.
 */
async function getCurrentLocation(): Promise<DrinkLocation | null> {
  try {
    // If the timeout wins the race, getCurrentPositionAsync keeps running and
    // may reject later with no awaiter; swallow that to avoid an unhandled
    // rejection. The catch returns null so the race still resolves cleanly.
    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);
    const timeoutPromise = new Promise<null>(resolve => {
      setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS);
    });
    const result = await Promise.race([positionPromise, timeoutPromise]);
    if (!result) {
      return null;
    }
    const location: DrinkLocation = {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      capturedAt: result.timestamp ?? Date.now(),
    };
    // Only attach accuracy when the OS actually reported a number. Realtime
    // Database rejects writes containing `undefined`, so an undefined field
    // here would silently drop the entire location on the Firebase write.
    if (typeof result.coords.accuracy === 'number') {
      location.accuracy = result.coords.accuracy;
    }
    return location;
  } catch {
    return null;
  }
}

export default getCurrentLocation;
