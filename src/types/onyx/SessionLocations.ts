import type {DrinksTimestamp} from './Drinks';

/** A single GPS fix captured at the moment a drink was logged in a live session. */
type DrinkLocation = {
  /** Decimal degrees, -90..90 */
  latitude: number;
  /** Decimal degrees, -180..180 */
  longitude: number;
  /** Reported horizontal accuracy in meters, when available */
  accuracy?: number;
  /** Capture time (ms since epoch). May differ slightly from the drink timestamp because the GPS request runs after the drink is added. */
  capturedAt: number;
};

/** Per-session map of drink-timestamp → location fix. Sparse: only timestamps with a captured fix appear here. */
type SessionLocations = Record<DrinksTimestamp, DrinkLocation>;

export default SessionLocations;
export type {DrinkLocation};
