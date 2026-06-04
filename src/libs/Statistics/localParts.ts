/**
 * Resolve a UTC instant's local wall-clock fields in a given timezone using a
 * single cached `Intl.DateTimeFormat.formatToParts` call, then derive ISO week
 * and calendar day-of-week arithmetically.
 *
 * This is the *one* place the app turns `(timestamp, timezone)` into local
 * calendar fields, shared by:
 *  - `buildDrinkEvents` (read path, as a fallback when stored fields are absent)
 *  - `buildSessionTimeParts` (write path, when a session is saved)
 *
 * Sharing it guarantees the value persisted at write time and the value
 * recomputed on the fly are byte-identical — there is no second implementation
 * to drift. Native `Intl` (not `date-fns-tz`) is used deliberately: `date-fns-tz`
 * is off-by-one-hour at the exact spring-forward instant, whereas `Intl` matches
 * the engine the app runs on.
 *
 * On Hermes each `formatToParts` call is ~2-3 ms, so the write path pays this
 * once per drink timestamp while the user is interacting, and the cold read path
 * pays nothing once the fields are stored.
 */

/**
 * One `Intl.DateTimeFormat` per timezone. Constructing the formatter is the
 * expensive part of timezone resolution, so we build it once and reuse it for
 * every timestamp in that zone — in practice a single zone per user.
 */
const localPartsFormatters = new Map<string, Intl.DateTimeFormat>();

function getLocalPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = localPartsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    localPartsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * ISO 8601 week label (`RRRR-'W'II`) for a UTC-midnight stamp of a local wall
 * day. The week-numbering year and week can both differ from the calendar year
 * at the Dec/Jan boundary — e.g. 2021-01-01 belongs to 2020-W53.
 */
function isoWeekLabel(localMidnightUtc: number): string {
  const thursday = new Date(localMidnightUtc);
  const dayFromMonday = (thursday.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - dayFromMonday + 3);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstOffset = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstOffset + 3);
  const week =
    1 +
    Math.round((thursday.getTime() - firstThursday.getTime()) / 604_800_000);
  return `${String(isoYear).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

type LocalParts = {
  /** `yyyy-MM-dd` in the target timezone. */
  localDay: string;
  /** `yyyy-MM` in the target timezone. */
  localMonth: string;
  /** 0..23 in the target timezone. */
  localHour: number;
  /** ISO-8601 week label `RRRR-Www` in the target timezone. */
  localIsoWeek: string;
  /** Calendar day of week, 0=Sunday..6=Saturday (weekStart-independent). */
  calendarDow: number;
};

/**
 * Resolve a timestamp's local wall-clock fields with a single cached
 * `formatToParts` call, then derive day-of-week and ISO week arithmetically.
 * Throws only on an invalid timezone (the caller skips); returns `null` if the
 * formatter omits a field, which no supported runtime does.
 */
function resolveLocalParts(ts: number, timeZone: string): LocalParts | null {
  const fields: Record<string, string> = {};
  for (const part of getLocalPartsFormatter(timeZone).formatToParts(ts)) {
    fields[part.type] = part.value;
  }
  const {year, month, day, hour} = fields;
  if (!year || !month || !day || !hour) {
    return null;
  }
  const localMidnightUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
  );
  return {
    localDay: `${year}-${month}-${day}`,
    localMonth: `${year}-${month}`,
    // `% 24` folds the "24" some ICU builds emit for midnight back to 0.
    localHour: Number(hour) % 24,
    localIsoWeek: isoWeekLabel(localMidnightUtc),
    calendarDow: new Date(localMidnightUtc).getUTCDay(),
  };
}

export {resolveLocalParts, isoWeekLabel};
export type {LocalParts};
