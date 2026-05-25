import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * Numeric day-of-week the user's week starts on, in date-fns convention
 * (0 = Sunday, 1 = Monday, ... 6 = Saturday). Callers translate from
 * `Preferences.first_day_of_week` (a string) at the React/hook layer.
 */
type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Per-drink event row, materialised once from sessions and reduced over by
 * every chart. All `local*` fields are precomputed in the session's
 * timezone so downstream code never reaches for `date-fns-tz` again.
 */
type DrinkEvent = {
  userId: UserID;
  sessionId: string;
  /** ms, per-drink timestamp (the `DrinksList` key), not the session start. */
  ts: number;
  /** `yyyy-MM-dd` in the session's timezone. */
  localDay: string;
  /** ISO-8601 week label `yyyy-Www` in the session's timezone. */
  localIsoWeek: string;
  /** `yyyy-MM` in the session's timezone. */
  localMonth: string;
  /** 0..23 in the session's timezone. */
  localHour: number;
  /** 0..6, rotated so 0 = the user's `WeekStart`. */
  localDow: number;
  /** Calendar Saturday/Sunday membership, independent of `WeekStart`. */
  isWeekend: boolean;
  drinkKey: DrinkKey;
  /** Entry count (>=1). */
  count: number;
  /** `count × drinks_to_units[drinkKey]`. */
  units: number;
  /** Standard drink units; populated when `volume_ml + abv` resolve. */
  sdu?: number;
  blackoutSession: boolean;
  /** `(end_time - start_time) / 60000`, undefined for ongoing or unended sessions. */
  sessionDurationMin?: number;
};

type DayRollup = {
  userId: UserID;
  dateKey: string;
  totalSdu: number;
  drinksCount: number;
  byType: Partial<Record<DrinkKey, number>>;
};

type WeekRollup = {
  userId: UserID;
  isoYear: number;
  isoWeek: number;
  weekStartDate: string;
  totalSdu: number;
  drinksCount: number;
  alcoholFreeDays: number;
};

type ChartDatum = {x: string | number; y: number};

type ChartRange = 'week' | 'month' | 'rolling30' | 'rolling8w' | 'allTime';

type HeatmapCell = {
  dateKey: string;
  totalSdu: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  /**
   * Reserves the grid slot but skips the rect so future days don't look
   * identical to logged-but-quiet ones. Per DIRECTION_REVIEW.md §6.2.
   */
  isFuture?: boolean;
};

type KpiDelta = {
  value: number;
  direction: 'up' | 'down' | 'flat';
  comparisonKey: 'vsLastWeek' | 'vsLastMonth';
};

type KpiKey =
  | 'alcoholFreeDays'
  | 'sessionsThisWeek'
  | 'avgUnitsPerSession'
  | 'totalUnitsThisWeek';

type KpiValue = {
  key: KpiKey;
  value: number | string;
  unit?: string;
  delta?: KpiDelta;
};

export type {
  DayRollup,
  WeekRollup,
  ChartDatum,
  ChartRange,
  DrinkEvent,
  HeatmapCell,
  KpiDelta,
  KpiKey,
  KpiValue,
  WeekStart,
};
