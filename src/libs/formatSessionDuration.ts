import * as Localize from '@libs/Localize';
import BaseLocaleListener from '@libs/Localize/LocaleListener/BaseLocaleListener';
import type Locale from '@src/types/onyx/Locale';

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;

/**
 * How long a finished session ran, for the session detail page (RFC §9):
 * `4h 20m`, or `35m` under an hour, in the locale's abbreviated time units.
 *
 * Deliberately not `formatElapsedTime`, which is a running clock (`4:20:00`)
 * and belongs on a live session, nor `numberToVerboseString`, which rounds to
 * one unit ("4 hours") and so hides most of a long night. Minutes are floored:
 * a session reads as no longer than it was.
 *
 * A session with no end time, or one whose end precedes its start (clock skew
 * on the device that closed it), reads as `0m` rather than a negative or an
 * empty string, so the stat never renders blank.
 */
function formatSessionDuration(
  durationMs: number,
  locale: Locale = BaseLocaleListener.getPreferredLocale(),
): string {
  const totalMinutes = Number.isFinite(durationMs)
    ? Math.max(0, Math.floor(durationMs / MS_PER_MINUTE))
    : 0;
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const hourUnit = Localize.translate(locale, 'timePeriods.abbreviated.hour');
  const minuteUnit = Localize.translate(
    locale,
    'timePeriods.abbreviated.minute',
  );

  if (hours === 0) {
    return `${minutes}${minuteUnit}`;
  }
  return `${hours}${hourUnit} ${minutes}${minuteUnit}`;
}

export default formatSessionDuration;
