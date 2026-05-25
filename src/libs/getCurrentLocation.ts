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
    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const timeoutPromise = new Promise<null>(resolve => {
      setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS);
    });
    const result = await Promise.race([positionPromise, timeoutPromise]);
    if (!result) {
      return null;
    }
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      accuracy:
        typeof result.coords.accuracy === 'number'
          ? result.coords.accuracy
          : undefined,
      capturedAt: result.timestamp ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export default getCurrentLocation;
