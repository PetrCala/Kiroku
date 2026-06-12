import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarISOWeeks,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import {tickIndices} from './axisFormatters';

/** Granularity of the dense series feeding the chart. */
type DateTickUnit = 'day' | 'week';

type DateTicks = {
  /** Integer x tickValues — indices into the dense series. */
  indices: number[];
  /** Tick value → label. Returns '' for indices without a label. */
  labelFor: (value: number) => string;
};

type BuildDateTicksParams = {
  /** First key of the series — `yyyy-MM-dd` (day) or `RRRR-'W'II` (week). */
  firstKey: string;
  /** Last key of the series, same format as `firstKey`. */
  lastKey: string;
  /** Series length. Keys are assumed dense between `firstKey` and `lastKey`. */
  length: number;
  unit: DateTickUnit;
};

type Boundary = {index: number; date: Date};

/** Snapped modes need at least this many boundaries to read as an axis. */
const MIN_SNAPPED_TICKS = 3;
const MAX_TICKS = 5;

/** Spans at or under a month keep day-level `MMM d` ticks. */
const DAY_MODE_MAX_DAYS = 31;
/** Spans over this many years drop months entirely and tick on Jan 1. */
const YEAR_MODE_MIN_YEARS = 3;

/** The date a series index represents: index 0 is `start`, then one unit per step. */
function dateAtIndex(start: Date, index: number, unit: DateTickUnit): Date {
  return unit === 'day' ? addDays(start, index) : addWeeks(start, index);
}

/** Evenly-spaced `MMM d` ticks — the legacy behavior, kept for short spans. */
function evenDayTicks(
  start: Date,
  length: number,
  unit: DateTickUnit,
): DateTicks {
  const indices = tickIndices(length);
  const labels = new Map<number, string>();
  for (const index of indices) {
    labels.set(index, format(dateAtIndex(start, index, unit), 'MMM d'));
  }
  return {indices, labelFor: value => labels.get(Math.round(value)) ?? ''};
}

/** Calendar boundaries (month or year starts) within `[start, end]`, in order. */
function boundaryDates(start: Date, end: Date, mode: 'month' | 'year'): Date[] {
  let cursor = mode === 'month' ? startOfMonth(start) : startOfYear(start);
  if (cursor.getTime() < start.getTime()) {
    cursor = mode === 'month' ? addMonths(cursor, 1) : addYears(cursor, 1);
  }
  const out: Date[] = [];
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor);
    cursor = mode === 'month' ? addMonths(cursor, 1) : addYears(cursor, 1);
  }
  return out;
}

/**
 * Adaptive x ticks for a dense, gap-filled date series. Picks a label
 * granularity from the span so ticks stay informative at every zoom:
 *
 *   - ≤ 31 days        → `MMM d` at evenly-spaced indices (legacy behavior).
 *   - up to 3 years    → month starts, `MMM` — or `MMM ''yy` when the
 *                        surviving ticks straddle a year boundary.
 *   - over 3 years     → year starts (Jan 1), `yyyy`.
 *
 * In the snapped (month/year) modes tick positions sit on real calendar
 * boundaries — a tick reads "here is where March starts" — and are
 * downsampled to at most {@link MAX_TICKS}, always keeping the first and
 * last boundary. When a snapped mode would yield fewer than
 * {@link MIN_SNAPPED_TICKS} boundaries (e.g. a ~6-week range), it falls
 * back to the day-level rendering, which is always distinct.
 *
 * Labels for weekly series come from the boundary date itself, not the
 * week key's Monday — the week containing Sun Mar 1 starts Mon Feb 23, and
 * "Feb" would be the wrong label for a March tick.
 *
 * Precondition: the series is dense — index `i` maps to `firstKey + i`
 * days/weeks. All chart series builders gap-fill, so this holds upstream.
 */
function buildDateTicks(params: BuildDateTicksParams): DateTicks {
  const {firstKey, lastKey, length, unit} = params;
  if (length <= 0) {
    return {indices: [], labelFor: () => ''};
  }

  // For weeks, anchor on the ISO week's Monday; the series covers through
  // the last week's Sunday.
  const start = unit === 'day' ? parseISO(firstKey) : parseISO(`${firstKey}-1`);
  const lastStart =
    unit === 'day' ? parseISO(lastKey) : parseISO(`${lastKey}-1`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(lastStart.getTime())) {
    return {indices: [], labelFor: () => ''};
  }
  const end = unit === 'day' ? lastStart : addDays(lastStart, 6);

  const spanDays = differenceInCalendarDays(end, start) + 1;
  if (spanDays <= DAY_MODE_MAX_DAYS) {
    return evenDayTicks(start, length, unit);
  }
  const mode = end > addYears(start, YEAR_MODE_MIN_YEARS) ? 'year' : 'month';

  // Snap to calendar boundaries and map each onto its series index.
  const seen = new Set<number>();
  let boundaries: Boundary[] = [];
  for (const date of boundaryDates(start, end, mode)) {
    const raw =
      unit === 'day'
        ? differenceInCalendarDays(date, start)
        : differenceInCalendarISOWeeks(date, start);
    const index = Math.min(Math.max(raw, 0), length - 1);
    if (!seen.has(index)) {
      seen.add(index);
      boundaries.push({index, date});
    }
  }

  if (boundaries.length < MIN_SNAPPED_TICKS) {
    return evenDayTicks(start, length, unit);
  }
  if (boundaries.length > MAX_TICKS) {
    boundaries = tickIndices(boundaries.length, MAX_TICKS).map(
      i => boundaries[i],
    );
  }

  const crossesYear =
    boundaries[0].date.getFullYear() !==
    boundaries[boundaries.length - 1].date.getFullYear();
  let pattern: string;
  if (mode === 'year') {
    pattern = 'yyyy';
  } else if (crossesYear) {
    pattern = "MMM ''yy";
  } else {
    pattern = 'MMM';
  }

  const labels = new Map<number, string>();
  for (const {index, date} of boundaries) {
    labels.set(index, format(date, pattern));
  }
  return {
    indices: boundaries.map(b => b.index),
    labelFor: value => labels.get(Math.round(value)) ?? '',
  };
}

export default buildDateTicks;
export type {DateTicks, DateTickUnit};
