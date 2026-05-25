/**
 * Internal numerical helpers for the stats module. Not re-exported via the
 * barrel — keep the public surface limited to ewma/mannKendall/percentile/
 * stddev/mean.
 */

/** Sign of a number, with 0 mapped to 0 (not +0/-0). */
function signum(x: number): -1 | 0 | 1 {
  if (x > 0) {
    return 1;
  }
  if (x < 0) {
    return -1;
  }
  return 0;
}

/**
 * Error function approximation per Abramowitz & Stegun §7.1.26.
 * Max absolute error ≈ 1.5e-7 — far tighter than the `p < 0.05` gate needs.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absX);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/** Standard normal cumulative distribution function Φ(z). */
function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export {signum, erf, normalCdf};
