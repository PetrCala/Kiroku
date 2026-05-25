import {useMemo} from 'react';
import {useChartTheme} from '@components/Charts/BaseChart';
import {ewma, mannKendall} from '@libs/Statistics/stats';
import {
  buildAfYtdSeries,
  buildWeeklyStackedSeries,
  buildWeeklyUnits,
  percentileBand,
  shiftRange,
} from '@libs/Statistics/trends';
import type {AfYtdPoint} from '@libs/Statistics/trends';
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
  band: {p25: number; p75: number} | null;
  captionKey: CaptionKey;
};

type Stack = {
  weeks: string[];
  byKey: Partial<Record<DrinkKey, number[]>>;
  trackedKeys: readonly DrinkKey[];
  palette: Partial<Record<DrinkKey, string>>;
  comparisonTotal?: number[];
};

type TrendsTabData = {
  hero: Hero;
  afYtd: {
    points: AfYtdPoint[];
    comparisonPoints?: AfYtdPoint[];
    hidden: boolean;
  };
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
 *   - Cumulative AF-days YTD series (and its comparison twin when enabled).
 *   - Per-DrinkKey weekly stack (respecting the active `drinkTypeFilter`).
 *
 * All series are zero-filled and index-aligned with their comparison
 * counterparts so the chart layer can read row-by-row without bounds checks.
 */
function useTrendsTabData(): TrendsTabData {
  const {events, isLoading} = useDrinkEvents();
  const {range, comparison, drinkTypeFilter} = useStatsContext();
  const theme = useChartTheme();

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
    const band = percentileBand(units);

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
      band,
      captionKey,
    };
  }, [events, range.start, range.end, comparisonRange]);

  // AF-days YTD.
  const afYtd = useMemo(() => {
    const hidden = range.preset === 'W';
    if (hidden) {
      return {points: [] as AfYtdPoint[], hidden};
    }
    const points = buildAfYtdSeries(events, range.start, range.end);
    let comparisonPoints: AfYtdPoint[] | undefined;
    if (comparisonRange) {
      const raw = buildAfYtdSeries(
        events,
        comparisonRange.start,
        comparisonRange.end,
      );
      // Pad to match `points.length` so the chart layer can index in lock-
      // step. Drop oldest or pad with the leading count, mirroring the hero
      // alignment policy.
      if (raw.length === points.length) {
        comparisonPoints = raw;
      } else if (raw.length > points.length) {
        comparisonPoints = raw.slice(raw.length - points.length);
      } else if (raw.length > 0) {
        const padCount = points.length - raw.length;
        const head = raw[0];
        const pad: AfYtdPoint[] = Array.from({length: padCount}, () => head);
        comparisonPoints = [...pad, ...raw];
      }
    }
    return {points, comparisonPoints, hidden};
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

    // Per-key palette: walk trackedKeys in ALL_DRINK_KEYS order, zipping
    // against `theme.drinkTypeRamp` positionally so colors stay stable when
    // the user toggles drink-type chips.
    const palette: Partial<Record<DrinkKey, string>> = {};
    ALL_DRINK_KEYS.forEach((key, i) => {
      if (trackedKeys.includes(key)) {
        palette[key] = theme.drinkTypeRamp[i] ?? theme.primaryFill;
      }
    });

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
  }, [
    events,
    range.start,
    range.end,
    drinkTypeFilter,
    comparisonRange,
    theme.drinkTypeRamp,
    theme.primaryFill,
  ]);

  return {hero, afYtd, stack, isLoading};
}

export default useTrendsTabData;
export type {CaptionKey, Hero, Stack, TrendsTabData};
