/**
 * Linear-interpolation percentile, matching `numpy.percentile` defaults and
 * R `quantile(type=7)`.
 *
 * `q` is a fraction in [0, 1] (values outside are clamped).
 *
 * Algorithm: sort ascending, then with `h = (n - 1) * q`,
 * `i = floor(h)`, `f = h - i`:
 *   result = sorted[i] + f * (sorted[i + 1] - sorted[i])
 * When q = 1, i = n - 1 and f = 0 so no out-of-bounds read.
 *
 * Edge cases:
 *   - empty input → NaN (callers — e.g. v2-H band-of-normal — skip render)
 *   - n = 1       → that single value for any q
 *   - q = 0       → min; q = 1 → max
 */
function percentile(series: number[], q: number): number {
  const n = series.length;
  if (n === 0) {
    return Number.NaN;
  }
  if (n === 1) {
    return series[0];
  }

  const clampedQ = Math.min(1, Math.max(0, q));
  const sorted = [...series].sort((a, b) => a - b);

  const h = (n - 1) * clampedQ;
  const i = Math.floor(h);
  const f = h - i;

  if (f === 0) {
    return sorted[i];
  }
  return sorted[i] + f * (sorted[i + 1] - sorted[i]);
}

export default percentile;
