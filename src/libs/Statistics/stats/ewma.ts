import {mean} from './stddev';

const DEFAULT_LAMBDA = 0.3;
const SEED_WINDOW = 4;

/**
 * Exponentially-weighted moving average over `series`.
 *
 * Seed: the returned series starts at `mean(series[0 .. min(4, n) - 1])`,
 * then iterates `s_i = lambda * x_i + (1 - lambda) * s_{i-1}` for i >= 1.
 * λ = 0.3 default per STATISTICS_V2.md §8.
 *
 * Edge cases:
 *   - empty input          → []
 *   - lambda = 0           → flat array at the seed value
 *   - lambda = 1           → seed at index 0, identity copy of input from i = 1
 *   - lambda outside [0,1] → caller error; not validated (consumer is internal)
 *
 * Gap handling: callers must pre-fill gaps before invoking. Every element is
 * treated as a real observation.
 */
function ewma(series: number[], lambda: number = DEFAULT_LAMBDA): number[] {
  const n = series.length;
  if (n === 0) {
    return [];
  }

  const seedWindow = Math.min(SEED_WINDOW, n);
  const seed = mean(series.slice(0, seedWindow));

  const out = new Array<number>(n);
  out[0] = seed;
  for (let i = 1; i < n; i += 1) {
    out[i] = lambda * series[i] + (1 - lambda) * out[i - 1];
  }
  return out;
}

export default ewma;
