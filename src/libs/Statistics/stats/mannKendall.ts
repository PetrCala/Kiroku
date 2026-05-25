import {normalCdf, signum} from './helpers';

const MIN_N = 8;
const ALPHA = 0.05;

type MannKendallResult = {
  /** Kendall's tau-b (tie-corrected). */
  tau: number;
  /** Raw S statistic. */
  sScore: number;
  /** Two-sided p-value via continuity-corrected normal approximation. */
  p: number;
  /**
   * Caption gate per STATISTICS_V2.md §8. Consumers MUST only render UI from
   * this field — `tau` and `p` are never to be displayed numerically.
   */
  trend: 'up' | 'down' | 'none';
};

/**
 * Sum of t*(t-1)*(2t+5) across all tie groups — used in Var(S) correction.
 */
function tieTermVariance(tieCounts: number[]): number {
  let sum = 0;
  for (const t of tieCounts) {
    sum += t * (t - 1) * (2 * t + 5);
  }
  return sum;
}

/**
 * Sum of t*(t-1)/2 across all tie groups — used in the tau-b denominator.
 */
function tieTermTau(tieCounts: number[]): number {
  let sum = 0;
  for (const t of tieCounts) {
    sum += (t * (t - 1)) / 2;
  }
  return sum;
}

/** Return the size of every tie group with size >= 2. */
function tieGroupSizes(series: number[]): number[] {
  if (series.length === 0) {
    return [];
  }
  const sorted = [...series].sort((a, b) => a - b);
  const groups: number[] = [];
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1]) {
      run += 1;
    } else {
      if (run >= 2) {
        groups.push(run);
      }
      run = 1;
    }
  }
  if (run >= 2) {
    groups.push(run);
  }
  return groups;
}

/**
 * Mann–Kendall trend test with tie correction and continuity-corrected
 * normal approximation. References:
 *   - Helsel & Hirsch, *Statistical Methods in Water Resources* (USGS Book
 *     4-A3, 2002), §12.4.3.
 *   - Hipel & McLeod, *Time Series Modelling of Water Resources and
 *     Environmental Systems* (1994), Ch. 23.
 *
 * The `trend` field is the only field consumers should render. `tau` and `p`
 * are returned for tests/debugging only — never display them numerically per
 * STATISTICS_V2.md §8.
 *
 * Trend gate: `trend = 'up' | 'down'` iff `p < 0.05` AND `n >= 8` AND
 * `sScore != 0`. Otherwise `'none'`. `n < 8` always returns `'none'`
 * regardless of p, per spec.
 */
function mannKendall(series: number[]): MannKendallResult {
  const n = series.length;
  if (n < 2) {
    return {tau: 0, sScore: 0, p: 1, trend: 'none'};
  }

  let sScore = 0;
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      sScore += signum(series[j] - series[i]);
    }
  }

  const ties = tieGroupSizes(series);
  const variance = (n * (n - 1) * (2 * n + 5) - tieTermVariance(ties)) / 18;

  let p: number;
  if (variance <= 0 || sScore === 0) {
    // No directional evidence — p is exactly 1 by definition. Skip the
    // normal-approximation path so erf rounding doesn't drift it to 0.9999…
    p = 1;
  } else {
    const z =
      sScore > 0
        ? (sScore - 1) / Math.sqrt(variance)
        : (sScore + 1) / Math.sqrt(variance);
    p = Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z)))));
  }

  const d0 = (n * (n - 1)) / 2;
  const denom = (d0 - tieTermTau(ties)) * d0;
  const tau = denom > 0 ? sScore / Math.sqrt(denom) : 0;

  let trend: 'up' | 'down' | 'none' = 'none';
  if (n >= MIN_N && p < ALPHA && sScore !== 0) {
    trend = sScore > 0 ? 'up' : 'down';
  }

  return {tau, sScore, p, trend};
}

export {mannKendall};
export type {MannKendallResult};
