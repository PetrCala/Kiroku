import {fromZonedTime, toZonedTime} from 'date-fns-tz';

/**
 * The time-of-day arithmetic behind the session times screen and the
 * per-entry time field. Kept out of the component so the interesting part,
 * the timezone round trip, is testable without a render tree.
 */

/**
 * Read a numeric time field, keeping it inside `[0, max]`.
 *
 * Anything unparseable reads as 0 rather than `NaN`: a `NaN` would reach
 * `setHours` and turn the whole timestamp invalid, which the user would see as
 * a session that jumped to 1970. Separators a keyboard may insert are
 * stripped, and only the first two digits count, so a fast typist cannot
 * produce "745" hours.
 */
function clampTimeField(text: string, max: number): number {
  const digits = text.replace(/\D/g, '').slice(0, 2);
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(Math.max(parsed, 0), max);
}

/** The hour and minute `value` reads as in `timezone`. */
function getTimeOfDay(
  value: number,
  timezone: string,
): {hours: number; minutes: number} {
  const zoned = toZonedTime(value, timezone);
  return {hours: zoned.getHours(), minutes: zoned.getMinutes()};
}

/**
 * Move `value` to `hours:minutes` **on the calendar day it already falls on
 * in `timezone`**, and return the resulting timestamp.
 *
 * The timezone matters: editing a session logged in Tokyo while sitting in
 * Prague has to move the time the user sees written on the session, not a
 * converted one. `toZonedTime` gives a Date whose local getters read as the
 * zoned wall clock, and `fromZonedTime` inverts that, so the two together are
 * "set the wall clock in that zone".
 *
 * Seconds and milliseconds are cleared, so a time the user typed is exactly
 * the time stored rather than that minute plus whatever seconds the original
 * timestamp carried.
 */
function withTimeOfDay(
  value: number,
  timezone: string,
  hours: number,
  minutes: number,
): number {
  const zoned = toZonedTime(value, timezone);
  zoned.setHours(hours, minutes, 0, 0);
  return fromZonedTime(zoned, timezone).valueOf();
}

export {clampTimeField, getTimeOfDay, withTimeOfDay};
