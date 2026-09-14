import {endOfMonth} from 'date-fns';
import type {MarkingProps} from 'react-native-calendars/src/calendar/day/marking';
import {sessionsToDayMarking} from '@libs/DataHandling';
import {resolveLocalParts} from '@libs/Statistics/localParts';
import {
  CALENDAR_AF_STREAK_CAP,
  resolvePalette,
} from '@libs/SessionColorPalettes';
import type {DrinkingSessionList, Preferences} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';
import buildMonthSections from './buildMonthSections';
import type {MonthWeek} from './buildMonthSections';

// Hand-rolled 'yyyy-MM-dd' (matches CONST.DATE.FNS_FORMAT_STRING). date-fns
// `format` is ~100× slower and this runs once per day across the whole loaded
// range — which can be years deep — so it dominated the day-overview mount
// (e.g. 77 months ≈ 2.3k `format` calls ≈ ~460ms on Hermes). The Date's local
// fields already carry the right wall-clock day (`toZonedTime` shifted them to
// the session's zone for the per-session key; the day list is built in local
// time), so reading them directly is both correct and cheap.
function toDateKey(date: Date): DateString {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month < 10 ? '0' : ''}${month}-${
    day < 10 ? '0' : ''
  }${day}` as DateString;
}

/** 'YYYY-MM' bucket key for a (year, 0-based month) pair. */
function toMonthKey(year: number, month: number): string {
  return `${year}-${month + 1 < 10 ? '0' : ''}${month + 1}`;
}

/** Per-day cell payload for one calendar day of a derived month. */
type DayCellData = {
  /** Marking to paint the day tile with (green "sober" marking for in-range
   *  days without sessions, session-colored otherwise). */
  marking: MarkingProps;
  /** Total units that day. Present only for days that have sessions —
   *  mirrors the legacy `unitsMap` sparseness. */
  units?: number;
  /** 1-based position of the day in its run of consecutive alcohol-free days,
   *  clamped to `CALENDAR_AF_STREAK_CAP`. Present only on alcohol-free days
   *  (no session, or sessions totalling 0 units without a blackout); the tile
   *  tints deeper along the run. */
  afStreak?: number;
};

/**
 * Everything the calendar needs to render one month, derived once and cached.
 * Object identity is stable across loaded-window widens (see the cache below),
 * which is what lets the week-list's row memoization hold while older months
 * stream in.
 */
type CalendarMonthData = {
  /** 'YYYY-MM'. */
  monthKey: string;
  /** Calendar year. */
  year: number;
  /** Calendar month (0-11). */
  month: number;
  /** Whole-month grid rows (the current month is clamped at today). */
  weeks: MonthWeek[];
  /** Cell payload for every in-range day of the month. */
  dayData: ReadonlyMap<DateString, DayCellData>;
  /** The month's sessions keyed by day — feeds the day-overview list merge. */
  entriesByDay: ReadonlyMap<DateString, DrinkingSessionKeyValue[]>;
  /** Sum of all session units in the month (the label row's total). */
  totalUnits: number;
  /** Alcohol-free run length (clamped) at the month's last derived day: the
   *  next month's `afStreakCarryIn`. 0 when the month ends on a session day. */
  trailingAfStreak: number;
};

type MonthEntriesByDay = ReadonlyMap<DateString, DrinkingSessionKeyValue[]>;

/**
 * Group a session list by the month of each session's *zoned* day key
 * ('YYYY-MM' → day → entries). Grouping on the timezone-shifted day (rather
 * than a raw `start_time` window) is what guarantees a session that lands on
 * the far side of a month boundary in its own timezone is derived with the
 * month it actually renders in — this replaces the legacy "window start − 1
 * day" boundary slop.
 */
function groupSessionsByMonth(
  sessions: DrinkingSessionList,
  defaultTimezone: string,
): Map<string, Map<DateString, DrinkingSessionKeyValue[]>> {
  const byMonth = new Map<string, Map<DateString, DrinkingSessionKeyValue[]>>();
  Object.entries(sessions).forEach(([sessionId, session]) => {
    // Resolve the session's zoned calendar day via the shared cached-offset
    // resolver (one `Intl` probe per timezone-month, then pure `Date.UTC`
    // arithmetic) instead of `toZonedTime`, which calls `Intl.formatToParts`
    // once *per session*. On Hermes each such call is ~1-3 ms; across a
    // multi-year history this O(N) pass re-runs on every `CACHED_DRINKING_SESSIONS`
    // identity change at launch (disk hydrate → time-parts backfill → app/open
    // merge), so the per-session `Intl` blocked the JS thread for seconds right
    // after the home screen painted — the calendar scrolled (UI thread) but taps
    // were dead (JS thread). `resolveLocalParts` is the same resolver
    // `buildDrinkEvents` and the session write-path use, so the calendar's day
    // bucketing now matches the stats engine exactly. A session carrying a
    // timezone this engine will not accept resolves at UTC+0 rather than
    // throwing, so the calendar renders it instead of dying on it.
    const parts = resolveLocalParts(
      Number(session.start_time),
      session.timezone ?? defaultTimezone,
    );
    if (!parts) {
      return;
    }
    const dayKey = parts.localDay as DateString;
    const monthKey = parts.localMonth;
    let dayMap = byMonth.get(monthKey);
    if (!dayMap) {
      dayMap = new Map();
      byMonth.set(monthKey, dayMap);
    }
    const existing = dayMap.get(dayKey);
    if (existing) {
      existing.push({sessionId, session});
    } else {
      dayMap.set(dayKey, [{sessionId, session}]);
    }
  });
  return byMonth;
}

type DeriveCalendarMonthArgs = {
  /** Calendar year. */
  year: number;
  /** Calendar month (0-11). */
  month: number;
  /** The month's sessions grouped by zoned day key (from
   *  `groupSessionsByMonth`), or undefined for a session-less month. */
  monthEntriesByDay: MonthEntriesByDay | undefined;
  /** Preferences with the resolved palette already substituted in (the hook's
   *  `effectivePreferences`). */
  effectivePreferences: Preferences;
  /** Last day to include — today for the current month, null (= whole month)
   *  for past months. */
  endClamp: Date | null;
  /** Alcohol-free run length carried over from the previous month's last day
   *  (its `trailingAfStreak`), so a run that crosses a month edge keeps
   *  ramping instead of restarting on the 1st. Defaults to 0. */
  afStreakCarryIn?: number;
};

/**
 * Derive one month's render payload: grid rows plus per-day markings, units,
 * session entries, and the month total. Pure — call `getDerivedCalendarMonth`
 * for the cached variant used on the render path.
 */
function deriveCalendarMonth({
  year,
  month,
  monthEntriesByDay,
  effectivePreferences,
  endClamp,
  afStreakCarryIn = 0,
}: DeriveCalendarMonthArgs): CalendarMonthData {
  const monthStart = new Date(year, month, 1);
  const sections = buildMonthSections({
    start: monthStart,
    end: endClamp ?? endOfMonth(monthStart),
  });
  const weeks = sections.length > 0 ? sections[0].weeks : [];

  const palette = resolvePalette(effectivePreferences.session_color_palette);
  const paletteGreen = palette.green;

  const dayData = new Map<DateString, DayCellData>();
  // Only in-range days enter `entriesByDay` — a session dated later today
  // (or on a future day of the current month) must not surface a day the
  // grid doesn't render, mirroring the legacy interval filter.
  const entriesByDay = new Map<DateString, DrinkingSessionKeyValue[]>();
  let totalUnits = 0;
  // Running alcohol-free streak. Seeded from the previous month so a run
  // spanning the month edge ramps continuously; clamped so the cache key stays
  // bounded and the tint math never overshoots.
  let afStreak = Math.min(CALENDAR_AF_STREAK_CAP, Math.max(0, afStreakCarryIn));

  weeks.forEach(week => {
    week.days.forEach(dayKey => {
      if (!dayKey) {
        return;
      }
      const entries = monthEntriesByDay?.get(dayKey);
      const marking = entries
        ? sessionsToDayMarking(
            entries.map(entry => entry.session),
            effectivePreferences,
          )
        : null;
      if (!marking) {
        afStreak = Math.min(CALENDAR_AF_STREAK_CAP, afStreak + 1);
        dayData.set(dayKey, {marking: {color: paletteGreen}, afStreak});
        return;
      }
      // A logged session with nothing in it (0 units, no blackout) is still an
      // alcohol-free day for the streak; anything else breaks the run.
      const isAlcoholFree =
        marking.units === 0 && marking.marking.color !== palette.black;
      afStreak = isAlcoholFree
        ? Math.min(CALENDAR_AF_STREAK_CAP, afStreak + 1)
        : 0;
      dayData.set(dayKey, {
        marking: marking.marking,
        units: marking.units,
        ...(isAlcoholFree ? {afStreak} : {}),
      });
      entriesByDay.set(dayKey, entries ?? []);
      totalUnits += marking.units;
    });
  });

  return {
    monthKey: toMonthKey(year, month),
    year,
    month,
    weeks,
    dayData,
    entriesByDay,
    totalUnits,
    trailingAfStreak: afStreak,
  };
}

type CachedMonth = {
  /** The month's session group at derive time — reference-compared to detect
   *  session changes (the grouping pass rebuilds all group maps whenever the
   *  source session list changes identity). */
  group: MonthEntriesByDay | undefined;
  value: CalendarMonthData;
};

// Month-derivation cache. Keyed first on the `effectivePreferences` identity
// (each mounted calendar builds its own object, so palettes/thresholds — and
// users — can never cross-contaminate; old branches are GC'd with their
// preferences object), then on `monthKey|endClampKey|afStreakCarryIn`. A
// loaded-window widen changes neither key nor group references for already
// derived months, so they are returned by identity, the property the
// week-list's row memoization relies on. The one exception is the month that
// was the loaded floor: widening can hand it a non-zero carry-in (a sober run
// that started in the newly loaded month), and then it re-derives once with
// the deeper tints: one month, on a widen, not on every render. Plain
// module-level memoization keeps the render path free of ref access, which
// React Compiler would otherwise reject.
const monthCache = new WeakMap<Preferences, Map<string, CachedMonth>>();

/** Cached `deriveCalendarMonth`. See the cache notes above. */
function getDerivedCalendarMonth(
  args: DeriveCalendarMonthArgs,
): CalendarMonthData {
  let byMonth = monthCache.get(args.effectivePreferences);
  if (!byMonth) {
    byMonth = new Map();
    monthCache.set(args.effectivePreferences, byMonth);
  }
  // Past months derive the same payload regardless of when they're derived;
  // the current month is clamped at today, so its entry is keyed by that day
  // and naturally misses (recomputes) after a date rollover.
  const endClampKey = args.endClamp ? toDateKey(args.endClamp) : '';
  const carryKey = Math.min(
    CALENDAR_AF_STREAK_CAP,
    Math.max(0, args.afStreakCarryIn ?? 0),
  );
  const cacheKey = `${toMonthKey(args.year, args.month)}|${endClampKey}|${carryKey}`;
  const cached = byMonth.get(cacheKey);
  if (cached && cached.group === args.monthEntriesByDay) {
    return cached.value;
  }
  const value = deriveCalendarMonth(args);
  byMonth.set(cacheKey, {group: args.monthEntriesByDay, value});
  return value;
}

export {
  deriveCalendarMonth,
  getDerivedCalendarMonth,
  groupSessionsByMonth,
  toDateKey,
  toMonthKey,
};
export type {CalendarMonthData, DayCellData, DeriveCalendarMonthArgs};
