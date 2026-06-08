import type {DrinkEvent} from '@libs/Statistics/types';
import {dayKeysInRange} from './keys';
import collectWindowAggregates from './windowAggregates';

/** Per-day unit cutoffs from the user's preferences (`units_to_colors`). */
type Thresholds = {yellow: number; orange: number};

/**
 * Average Gregorian month length (365.25 / 12). Normalizes the range's unit
 * rate into a per-month projection, so short windows extrapolate up to a month
 * and long windows collapse to a true units-per-month average.
 */
const AVG_DAYS_PER_MONTH = 365.25 / 12;

/**
 * Count of elapsed days falling in each severity band. Sums to
 * `elapsedDays`. `green` is the alcohol-free count by definition.
 */
type BandCounts = {
  /** units === 0 (alcohol-free). */
  green: number;
  /** 0 < units <= yellow. */
  yellow: number;
  /** yellow < units <= orange. */
  orange: number;
  /** units > orange. */
  red: number;
};

/**
 * Every absolute, total-alcohol metric the Overview scorecard shows for one
 * window. Computed off a single per-day pass so the headline numbers, the
 * risk counts, and the distribution bands can never disagree.
 *
 * Day-based metrics use *elapsed* days only — the window end is clamped to
 * `now`, so a half-finished current period never counts future days as dry.
 * Thresholds are applied to a day's *total* units (a day aggregates multiple
 * sessions), which is a deliberate reinterpretation of the per-session
 * `units_to_colors` cutoff used by the session-color UI.
 */
type PeriodSummary = {
  elapsedDays: number;
  totalUnits: number;
  sessions: number;
  drinkingDays: number;
  /** elapsedDays − drinkingDays. */
  afDays: number;
  longestDryStreak: number;
  heaviestDay: number;
  /** totalUnits / drinkingDays, or 0 when there were no drinking days. */
  avgUnitsPerDrinkingDay: number;
  /**
   * Units per month, projected from the range's rate
   * (`totalUnits / elapsedDays * AVG_DAYS_PER_MONTH`), or 0 for an empty
   * window. Short ranges extrapolate up; long ranges read as the real
   * monthly average.
   */
  monthlyAvgUnits: number;
  /** Days with units strictly over the yellow threshold (orange + red bands). */
  daysOverYellow: number;
  /** Days with units strictly over the orange threshold (red band). */
  daysOverOrange: number;
  distribution: BandCounts;
};

const EMPTY_SUMMARY: PeriodSummary = {
  elapsedDays: 0,
  totalUnits: 0,
  sessions: 0,
  drinkingDays: 0,
  afDays: 0,
  longestDryStreak: 0,
  heaviestDay: 0,
  avgUnitsPerDrinkingDay: 0,
  monthlyAvgUnits: 0,
  daysOverYellow: 0,
  daysOverOrange: 0,
  distribution: {green: 0, yellow: 0, orange: 0, red: 0},
};

/**
 * Derive a {@link PeriodSummary} from a window's precomputed per-day unit sums
 * and session count — a pure pass over `dayKeys`, no event walk. Callers that
 * already hold a {@link WindowAggregates} (the Overview model) reuse the single
 * collection pass instead of re-aggregating the events.
 */
function summarizePeriod(
  unitsByDay: ReadonlyMap<string, number>,
  sessionCount: number,
  dayKeys: readonly string[],
  thresholds: Thresholds,
): PeriodSummary {
  const distribution: BandCounts = {green: 0, yellow: 0, orange: 0, red: 0};
  let totalUnits = 0;
  let drinkingDays = 0;
  let heaviestDay = 0;
  let currentDryStreak = 0;
  let longestDryStreak = 0;

  for (const key of dayKeys) {
    const units = unitsByDay.get(key) ?? 0;
    totalUnits += units;
    if (units > heaviestDay) {
      heaviestDay = units;
    }
    if (units <= 0) {
      distribution.green += 1;
      currentDryStreak += 1;
      if (currentDryStreak > longestDryStreak) {
        longestDryStreak = currentDryStreak;
      }
    } else {
      drinkingDays += 1;
      currentDryStreak = 0;
      if (units <= thresholds.yellow) {
        distribution.yellow += 1;
      } else if (units <= thresholds.orange) {
        distribution.orange += 1;
      } else {
        distribution.red += 1;
      }
    }
  }

  return {
    elapsedDays: dayKeys.length,
    totalUnits,
    sessions: sessionCount,
    drinkingDays,
    afDays: distribution.green,
    longestDryStreak,
    heaviestDay,
    avgUnitsPerDrinkingDay: drinkingDays > 0 ? totalUnits / drinkingDays : 0,
    monthlyAvgUnits:
      dayKeys.length > 0
        ? (totalUnits / dayKeys.length) * AVG_DAYS_PER_MONTH
        : 0,
    daysOverYellow: distribution.orange + distribution.red,
    daysOverOrange: distribution.red,
    distribution,
  };
}

/**
 * Build a {@link PeriodSummary} for the inclusive window `[start, end]`,
 * clamping the effective end to `now` so future days are never counted.
 * Convenience wrapper over a single {@link collectWindowAggregates} pass — used
 * directly for the comparison window and kept as a standalone, separately
 * tested unit.
 */
function buildPeriodSummary(
  events: readonly DrinkEvent[],
  start: Date,
  end: Date,
  now: Date,
  thresholds: Thresholds,
): PeriodSummary {
  const startMs = start.getTime();
  const effectiveEndMs = Math.min(end.getTime(), now.getTime());
  if (effectiveEndMs < startMs) {
    return EMPTY_SUMMARY;
  }
  const {unitsByDay, sessionCount} = collectWindowAggregates(
    events,
    startMs,
    effectiveEndMs,
  );
  const dayKeys = dayKeysInRange(start, new Date(effectiveEndMs));
  return summarizePeriod(unitsByDay, sessionCount, dayKeys, thresholds);
}

export default buildPeriodSummary;
export {EMPTY_SUMMARY, summarizePeriod};
export type {BandCounts, PeriodSummary, Thresholds};
