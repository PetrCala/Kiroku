import {parseISO} from 'date-fns';
import {dayAndShortMonth, shortMonth, shortWeekday} from '@libs/dateLabels';
import DateUtils from '@libs/DateUtils';
import type {Bucketer} from '@libs/Statistics/aggregate';
import {byDay, byIsoWeek, byMonth, byYear} from '@libs/Statistics/bucketers';
import {weekKeysInRange} from '@libs/Statistics/trends';
import type {DrinkEvent} from '@libs/Statistics/types';
import type {Range} from '@components/StatsContextProvider/types';
import type Locale from '@src/types/onyx/Locale';
import {dayKeysInRange, monthKeysInRange, yearKeysInRange} from './keys';
import collectWindowAggregates from './windowAggregates';

type Granularity = 'day' | 'week' | 'month' | 'year';

type SubPeriodPoint = {
  /**
   * Bucket key for the sub-period: `yyyy-MM-dd` (day), `RRRR-'W'II` (week),
   * `yyyy-MM` (month) or `yyyy` (year).
   *
   * Deliberately NOT a display string. The label depends on the viewer's
   * language, this model is memoized per data window, and a label baked in
   * here would survive a language switch unchanged. Render it with
   * {@link formatSubPeriodLabel}.
   */
  key: string;
  units: number;
};

const MS_PER_DAY = 86_400_000;

/**
 * Choose the sub-period granularity for the texture bar-list / hero sparkline
 * from the selected range, so a Week shows days, a Month shows weeks, etc.
 * `Custom` falls back to the window span.
 */
function pickGranularity(range: Range): Granularity {
  switch (range.preset) {
    case 'W':
      return 'day';
    case 'M':
      return 'week';
    case '6M':
    case 'Y':
      return 'month';
    case 'All':
      return 'year';
    case 'Custom':
    default: {
      const days = Math.round(
        (range.end.getTime() - range.start.getTime()) / MS_PER_DAY,
      );
      if (days <= 14) {
        return 'day';
      }
      if (days <= 92) {
        return 'week';
      }
      if (days <= 366 * 3) {
        return 'month';
      }
      return 'year';
    }
  }
}

/**
 * Short axis label for a bucket key, e.g. `Mon`, `May 5`, `May`, `2026` (or
 * `Po`, `5. kvě`, `Květen` in Czech). Pure: the locale is injected rather than
 * read from a global, so a label can never go stale behind a language switch.
 *
 * Callers that want a "Week of …" framing add the localized prefix themselves.
 */
function formatSubPeriodLabel(
  granularity: Granularity,
  key: string,
  preferredLocale: Locale,
): string {
  const locale = DateUtils.getDateFnsLocale(preferredLocale);
  switch (granularity) {
    case 'day':
      return shortWeekday(parseISO(key), locale);
    case 'week':
      // `RRRR-'W'II` resolves to the ISO week's Monday.
      return dayAndShortMonth(parseISO(`${key}-1`), locale);
    case 'month':
      return shortMonth(parseISO(`${key}-01`), locale);
    case 'year':
    default:
      return key;
  }
}

function bucketerFor(granularity: Granularity): Bucketer<string> {
  switch (granularity) {
    case 'day':
      return byDay;
    case 'week':
      return byIsoWeek;
    case 'month':
      return byMonth;
    case 'year':
    default:
      return byYear;
  }
}

function keysFor(granularity: Granularity, start: Date, end: Date): string[] {
  switch (granularity) {
    case 'day':
      return dayKeysInRange(start, end);
    case 'week':
      return weekKeysInRange(start, end);
    case 'month':
      return monthKeysInRange(start, end);
    case 'year':
    default:
      return yearKeysInRange(start, end);
  }
}

/**
 * Gap-filled per-sub-period series from precomputed unit sums: every key in the
 * window, in order, mapped to its summed units (0 where the bucket is absent).
 * Splitting this out lets the Overview model feed it the sub-period map from the
 * shared {@link collectWindowAggregates} pass.
 */
function seriesFromUnits(
  unitsBySubPeriod: ReadonlyMap<string, number>,
  granularity: Granularity,
  start: Date,
  end: Date,
): SubPeriodPoint[] {
  return keysFor(granularity, start, end).map(key => ({
    key,
    units: unitsBySubPeriod.get(key) ?? 0,
  }));
}

/**
 * Gap-filled per-sub-period units series for `range`, clamped to `now`. Drives
 * both the hero sparkline and the texture bar-list off one bucketing so they
 * always agree on granularity. Convenience wrapper over a single
 * {@link collectWindowAggregates} pass; kept as a standalone, tested unit.
 */
function buildSubPeriodSeries(
  events: readonly DrinkEvent[],
  range: Range,
  now: Date,
): SubPeriodPoint[] {
  const startMs = range.start.getTime();
  const effectiveEndMs = Math.min(range.end.getTime(), now.getTime());
  if (effectiveEndMs < startMs) {
    return [];
  }
  const granularity = pickGranularity(range);
  const {unitsBySubPeriod} = collectWindowAggregates(
    events,
    startMs,
    effectiveEndMs,
    bucketerFor(granularity),
  );
  return seriesFromUnits(
    unitsBySubPeriod,
    granularity,
    range.start,
    new Date(effectiveEndMs),
  );
}

export default buildSubPeriodSeries;
export {bucketerFor, formatSubPeriodLabel, pickGranularity, seriesFromUnits};
export type {Granularity, SubPeriodPoint};
