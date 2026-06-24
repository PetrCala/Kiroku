import {useMemo} from 'react';
import {DRINK_KEY_COLORS} from '@libs/Statistics/drinkKeyMeta';
import {ewma, mannKendall} from '@libs/Statistics/stats';
import {
  buildWeeklyAfDays,
  buildWeeklyStackedSeries,
  buildWeeklyUnits,
  shiftRange,
  summarizeWeeklyAfDays,
} from '@libs/Statistics/trends';
import type {WeeklyAfDaysSummary} from '@libs/Statistics/trends';
import useStatsContext from '@hooks/useStatsContext';
import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import useDrinkEvents from './useDrinkEvents';

type CaptionKey = 'trendingUp' | 'trendingDown' | 'neutral' | 'notEnoughData';

type Hero = {
  weeks: string[];
  units: number[];
  ewma?: number[];
  comparison?: number[];
  captionKey: CaptionKey;
};

type Stack = {
  weeks: string[];
  byKey: Partial<Record<DrinkKey, number[]>>;
  trackedKeys: readonly DrinkKey[];
  palette: Partial<Record<DrinkKey, string>>;
  comparisonTotal?: number[];
};

type WeeklyAf = {
  weeks: string[];
  afDays: number[];
  comparison?: number[];
  summary: WeeklyAfDaysSummary;
  hidden: boolean;
};

type TrendsTabData = {
  hero: Hero;
  weeklyAf: WeeklyAf;
  stack: Stack;
  isLoading: boolean;
};

const MIN_TREND_N = 8;
const MIN_EWMA_N = 4;

const ALL_DRINK_KEYS: readonly DrinkKey[] = Object.values(CONST.DRINKS.KEYS);

/**
 * Single composed data hook backing the Trends tab. Reads the event stream
 * once, then derives:
 *
 *   - Hero weekly-units series (raw + EWMA + band + Mann–Kendall caption).
 *   - Weekly alcohol-free-days series over the range (and its comparison twin
 *     when enabled).
 *   - Per-DrinkKey weekly stack (respecting the active `drinkTypeFilter`).
 *
 * All series are zero-filled and index-aligned with their comparison
 * counterparts so the chart layer can read row-by-row without bounds checks.
 */
function useTrendsTabData(): TrendsTabData {
  const {events, isLoading} = useDrinkEvents();
  const {range, comparison, drinkTypeFilter} = useStatsContext();

  const comparisonRange = useMemo(
    () => shiftRange(range, comparison),
    [range, comparison],
  );

  // Hero — weekly units.
  const hero = useMemo<Hero>(() => {
    const weekly = buildWeeklyUnits(events, range.start, range.end);
    const weeks = weekly.map(p => p.isoWeek);
    const units = weekly.map(p => p.units);

    const ewmaSeries =
      units.length >= MIN_EWMA_N ? ewma(units, 0.3) : undefined;

    const comparisonUnits = comparisonRange
      ? buildWeeklyUnits(
          events,
          comparisonRange.start,
          comparisonRange.end,
        ).map(p => p.units)
      : undefined;

    // Pad / trim comparison to match weeks.length so the chart can index by
    // position. We rely on shiftRange producing same-length windows; clamp
    // defensively.
    let comparisonAligned: number[] | undefined;
    if (comparisonUnits) {
      if (comparisonUnits.length === weeks.length) {
        comparisonAligned = comparisonUnits;
      } else if (comparisonUnits.length > weeks.length) {
        comparisonAligned = comparisonUnits.slice(
          comparisonUnits.length - weeks.length,
        );
      } else {
        const padding = new Array<number>(
          weeks.length - comparisonUnits.length,
        ).fill(0);
        comparisonAligned = [...padding, ...comparisonUnits];
      }
    }

    let captionKey: CaptionKey = 'notEnoughData';
    if (units.length >= MIN_TREND_N) {
      const mk = mannKendall(units);
      if (mk.trend === 'up') captionKey = 'trendingUp';
      else if (mk.trend === 'down') captionKey = 'trendingDown';
      else captionKey = 'neutral';
    }

    return {
      weeks,
      units,
      ewma: ewmaSeries,
      comparison: comparisonAligned,
      captionKey,
    };
  }, [events, range.start, range.end, comparisonRange]);

  // Weekly alcohol-free days.
  const weeklyAf = useMemo<WeeklyAf>(() => {
    // A single week of bars is trivial; keep this chart for the longer presets.
    const hidden = range.preset === 'W';
    if (hidden) {
      return {
        weeks: [],
        afDays: [],
        summary: {afDays: 0, totalDays: 0, ratePct: 0},
        hidden,
      };
    }

    const points = buildWeeklyAfDays(events, range.start, range.end);
    const weeks = points.map(p => p.isoWeek);
    const afDays = points.map(p => p.afDays);
    const summary = summarizeWeeklyAfDays(points);

    let comparisonAf: number[] | undefined;
    if (comparisonRange) {
      const raw = buildWeeklyAfDays(
        events,
        comparisonRange.start,
        comparisonRange.end,
      ).map(p => p.afDays);
      // Pad / trim to match weeks.length so the chart can index by position,
      // mirroring the hero alignment policy.
      if (raw.length === weeks.length) {
        comparisonAf = raw;
      } else if (raw.length > weeks.length) {
        comparisonAf = raw.slice(raw.length - weeks.length);
      } else {
        comparisonAf = [
          ...new Array<number>(weeks.length - raw.length).fill(0),
          ...raw,
        ];
      }
    }

    return {weeks, afDays, comparison: comparisonAf, summary, hidden};
  }, [events, range.start, range.end, range.preset, comparisonRange]);

  // Drink-type stacked area.
  const stack = useMemo<Stack>(() => {
    const {weeks, trackedKeys} = buildWeeklyStackedSeries(
      events,
      range.start,
      range.end,
      drinkTypeFilter,
      ALL_DRINK_KEYS,
    );
    // Pivot the per-week row data into per-key arrays for the StackedArea
    // component, which prefers column-major input.
    const weekLabels = weeks.map(w => w.isoWeek);
    const byKey: Partial<Record<DrinkKey, number[]>> = {};
    for (const key of trackedKeys) {
      byKey[key] = weeks.map(w => w.byKey[key] ?? 0);
    }

    // Per-key palette from the shared drink-type colors — a keyed lookup (not
    // a positional zip), so each drink keeps its own color regardless of which
    // chips are toggled and it matches the Breakdown donut exactly.
    const palette: Partial<Record<DrinkKey, string>> = {};
    for (const key of trackedKeys) {
      palette[key] = DRINK_KEY_COLORS[key];
    }

    let comparisonTotal: number[] | undefined;
    if (comparisonRange) {
      const cmp = buildWeeklyStackedSeries(
        events,
        comparisonRange.start,
        comparisonRange.end,
        drinkTypeFilter,
        ALL_DRINK_KEYS,
      );
      const totals = cmp.weeks.map(w => {
        let sum = 0;
        for (const k of cmp.trackedKeys) {
          sum += w.byKey[k] ?? 0;
        }
        return sum;
      });
      if (totals.length === weekLabels.length) {
        comparisonTotal = totals;
      } else if (totals.length > weekLabels.length) {
        comparisonTotal = totals.slice(totals.length - weekLabels.length);
      } else {
        comparisonTotal = [
          ...new Array<number>(weekLabels.length - totals.length).fill(0),
          ...totals,
        ];
      }
    }

    return {
      weeks: weekLabels,
      byKey,
      trackedKeys,
      palette,
      comparisonTotal,
    };
  }, [events, range.start, range.end, drinkTypeFilter, comparisonRange]);

  return {hero, weeklyAf, stack, isLoading};
}

export default useTrendsTabData;
export type {CaptionKey, Hero, Stack, TrendsTabData, WeeklyAf};
