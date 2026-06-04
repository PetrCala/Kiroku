/**
 * Resolve a UTC instant's local wall-clock fields in a given timezone, then
 * derive ISO week and calendar day-of-week arithmetically.
 *
 * This is the *one* place the app turns `(timestamp, timezone)` into local
 * calendar fields, shared by:
 *  - `buildDrinkEvents` (read path, as a fallback when stored fields are absent)
 *  - `buildSessionTimeParts` (write path, when a session is saved)
 *
 * Sharing it guarantees the value persisted at write time and the value
 * recomputed on the fly are byte-identical — there is no second implementation
 * to drift. Native `Intl` (not `date-fns-tz`) is the source of truth for the
 * UTC offset: `date-fns-tz` is off-by-one-hour at the exact spring-forward
 * instant, whereas `Intl` matches the engine the app runs on.
 *
 * On Hermes each `Intl.formatToParts` call is ~1-3 ms, and the cold read path
 * can face hundreds of timestamps with no stored fields at once (a fresh
 * install's whole history). So we never format per field: we use `Intl` only to
 * learn the timezone's *UTC offset*, cache that offset per (timezone, UTC
 * month), and compute every calendar field with plain `Date.UTC` arithmetic.
 * A timezone's offset changes at most once inside a calendar month (DST
 * transitions are months apart), so two probes at a month's edges decide it:
 * equal offsets ⇒ one offset serves the entire month with zero further `Intl`;
 * unequal ⇒ the rare transition month, where each timestamp is probed directly
 * (still exact). The cache is keyed by UTC month, so it is shared across every
 * session and drink regardless of how the timestamps are distributed.
 */

/**
 * One `Intl.DateTimeFormat` per timezone. Constructing the formatter is the
 * expensive part, so we build it once and reuse it for every offset probe in
 * that zone. Minute and second precision are included so sub-hour offsets
 * (e.g. UTC+5:45, UTC+10:30) resolve exactly.
 */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function getOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The UTC offset (ms) that applies to `ts` in `timeZone`, via a single `Intl`
 * call. Derived as `wallClock - ts`: the formatter yields the local wall clock,
 * and the difference is the offset. Rounded to the nearest minute because the
 * formatter drops sub-second precision while every real-world offset is a whole
 * number of minutes. Throws on an invalid timezone (formatter construction) —
 * the caller skips that timestamp.
 */
function probeOffsetMs(ts: number, timeZone: string): number {
  const fields: Record<string, string> = {};
  for (const part of getOffsetFormatter(timeZone).formatToParts(ts)) {
    fields[part.type] = part.value;
  }
  const wallUtc = Date.UTC(
    Number(fields.year),
    Number(fields.month) - 1,
    Number(fields.day),
    Number(fields.hour) % 24,
    Number(fields.minute),
    Number(fields.second),
  );
  return Math.round((wallUtc - ts) / 60_000) * 60_000;
}

/** Per timezone: the resolved offset for each seen UTC month. */
type MonthOffset = number | 'mixed';
const monthOffsetCache = new Map<string, Map<number, MonthOffset>>();

/** UTC-midnight of the first day of a `year*12 + monthZeroBased` index. */
function monthStartUtc(monthIndex: number): number {
  return Date.UTC(Math.floor(monthIndex / 12), monthIndex % 12, 1);
}

/**
 * The UTC offset (ms) for `ts` in `timeZone`, memoised per UTC month. The first
 * timestamp in a month pays two `Intl` probes (month start and end); if they
 * agree the offset is constant all month and every later timestamp that month
 * is free. A `'mixed'` month (a DST transition lies inside it) probes each
 * timestamp directly, so the result stays exact at the transition instant.
 */
function getTzOffsetMs(ts: number, timeZone: string): number {
  const at = new Date(ts);
  const monthIndex = at.getUTCFullYear() * 12 + at.getUTCMonth();
  let byMonth = monthOffsetCache.get(timeZone);
  if (!byMonth) {
    byMonth = new Map();
    monthOffsetCache.set(timeZone, byMonth);
  }
  let cell = byMonth.get(monthIndex);
  if (cell === undefined) {
    const startOffset = probeOffsetMs(monthStartUtc(monthIndex), timeZone);
    const endOffset = probeOffsetMs(
      monthStartUtc(monthIndex + 1) - 1,
      timeZone,
    );
    cell = startOffset === endOffset ? startOffset : 'mixed';
    byMonth.set(monthIndex, cell);
  }
  return cell === 'mixed' ? probeOffsetMs(ts, timeZone) : cell;
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
 * Resolve a timestamp's local wall-clock fields. The timezone's UTC offset
 * (cached per month) maps the instant onto a local wall clock, and every field
 * is then `Date.UTC` arithmetic — no per-field formatting. Throws only on an
 * invalid timezone (the caller skips).
 */
function resolveLocalParts(ts: number, timeZone: string): LocalParts | null {
  const wall = new Date(ts + getTzOffsetMs(ts, timeZone));
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth() + 1;
  const day = wall.getUTCDate();
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const localMidnightUtc = Date.UTC(year, month - 1, day);
  return {
    localDay: `${yyyy}-${mm}-${dd}`,
    localMonth: `${yyyy}-${mm}`,
    localHour: wall.getUTCHours(),
    localIsoWeek: isoWeekLabel(localMidnightUtc),
    calendarDow: new Date(localMidnightUtc).getUTCDay(),
  };
}

export {resolveLocalParts, isoWeekLabel};
export type {LocalParts};
