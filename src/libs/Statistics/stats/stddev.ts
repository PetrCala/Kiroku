/**
 * Arithmetic mean of a numeric series.
 * Returns 0 on empty input (matches stddev's degradation rule so callers can
 * treat both safely without guarding for NaN).
 */
function mean(series: number[]): number {
  if (series.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of series) {
    sum += v;
  }
  return sum / series.length;
}

/**
 * Sample standard deviation (Bessel-corrected: divide by n - 1).
 * Returns 0 if n < 2 (covers empty and single-value inputs).
 * Constant series → 0 trivially.
 */
function stddev(series: number[]): number {
  const n = series.length;
  if (n < 2) {
    return 0;
  }
  const mu = mean(series);
  let sumSquared = 0;
  for (const v of series) {
    const d = v - mu;
    sumSquared += d * d;
  }
  return Math.sqrt(sumSquared / (n - 1));
}

export {mean, stddev};
