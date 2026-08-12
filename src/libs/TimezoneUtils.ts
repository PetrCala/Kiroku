import type {SelectedTimezone} from '@src/types/onyx/UserData';

/**
 * Hardened timezone resolution.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` is not guaranteed to
 * return a name the same engine will accept back as a `timeZone` option. On
 * Hermes/Apple the resolver can hand back `GMT` (seen on a GitHub Actions iOS
 * simulator whose host runs at UTC), while Hermes validates the `timeZone`
 * option against `NSTimeZone.knownTimeZoneNames` plus the abbreviation
 * dictionary, and raises `RangeError: Invalid timeZoneName` for anything else.
 *
 * That mismatch was fatal: `CONST.DEFAULT_TIME_ZONE` resolves the device zone at
 * module scope, so the first formatter built from it threw ~1.5s into launch,
 * before the first render. The runtime died with an unhandled JS exception, the
 * JS force-hide net in `SplashScreenHider` never ran, and the app sat on the
 * boot splash forever with nothing on screen to explain it.
 *
 * So no zone name is trusted here on its word: each one is validated by actually
 * building a formatter from it, and anything that fails is swapped for a
 * known-good zone. This runs in both directions, because a name read back out of
 * Onyx (persisted by an older build, or synced from another device) can be just
 * as unusable on this engine as one the platform resolved.
 *
 * The module is deliberately dependency-free: `CONST` imports it and evaluates
 * it at module scope, so nothing here may throw or drag in the app's import
 * graph.
 */

/**
 * Fallback zones, best first. `Etc/UTC` is the canonical IANA spelling and what
 * V8 (web, Node) accepts; Apple's timezone tables do not list it, so Hermes on
 * iOS lands on `UTC` instead. `Africa/Abidjan` closes the chain because it is a
 * plain region zone sitting at UTC+0 with no DST, present in every tz database
 * and in the app's own `TIMEZONES` picker list. Which entry wins is decided by
 * probing the engine, never by assuming.
 */
const FALLBACK_TIMEZONE_CANDIDATES = [
  'Etc/UTC',
  'UTC',
  'GMT',
  'Africa/Abidjan',
] as const;

/** Memoised `zone name -> can this engine build a formatter for it`. */
const validityCache = new Map<string, boolean>();

/**
 * Whether a formatter can be built and used for `timeZone` on this engine.
 * Construction is where Hermes rejects an unknown name, and formatting is what
 * every consumer ultimately does (`date-fns-tz` and `resolveLocalParts` both go
 * through `formatToParts`), so both are probed.
 */
function canFormatInTimezone(timeZone: string): boolean {
  try {
    const probe = new Intl.DateTimeFormat('en-US', {timeZone});
    probe.formatToParts(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether `timeZone` is a name this engine will accept as a `timeZone` option.
 * Results are memoised per name: validation costs one formatter construction,
 * which is the expensive part of `Intl` on Hermes.
 */
function isValidTimezone(timeZone: unknown): timeZone is SelectedTimezone {
  if (typeof timeZone !== 'string' || timeZone.trim().length === 0) {
    return false;
  }
  const cached = validityCache.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }
  const isValid = canFormatInTimezone(timeZone);
  validityCache.set(timeZone, isValid);
  return isValid;
}

let fallbackTimezone: SelectedTimezone | undefined;

/**
 * The first fallback candidate this engine accepts, resolved once on first use.
 * Resolution is lazy so a device with a perfectly good zone pays nothing for it
 * at launch. If every candidate somehow fails, the canonical name is returned
 * anyway: there is nothing better to hand back, and returning it keeps this
 * function total (it must never throw, least of all during `CONST`'s import).
 */
function getFallbackTimezone(): SelectedTimezone {
  if (fallbackTimezone) {
    return fallbackTimezone;
  }
  let resolved: string = FALLBACK_TIMEZONE_CANDIDATES[0];
  for (const candidate of FALLBACK_TIMEZONE_CANDIDATES) {
    if (isValidTimezone(candidate)) {
      resolved = candidate;
      break;
    }
  }
  fallbackTimezone = resolved as SelectedTimezone;
  return fallbackTimezone;
}

/**
 * Pass a usable zone name through unchanged, and swap anything else (garbage,
 * a name from another platform, `undefined`) for the fallback. Use this on every
 * zone read back from storage or handed in by a caller, right before it reaches
 * a formatter.
 */
function sanitizeTimezone(timeZone: unknown): SelectedTimezone {
  return isValidTimezone(timeZone) ? timeZone : getFallbackTimezone();
}

/**
 * The device's zone, validated. Both the resolution and the validation are
 * guarded: `resolvedOptions()` can itself throw on an engine whose default zone
 * is unusable, and on Android `Intl` may not exist yet when this runs (the
 * polyfill is installed later, in `setup`).
 */
function getDeviceTimezone(): SelectedTimezone {
  try {
    return sanitizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return getFallbackTimezone();
  }
}

export {
  getDeviceTimezone,
  getFallbackTimezone,
  isValidTimezone,
  sanitizeTimezone,
};
