/**
 * @jest-environment node
 */

import percentileBand from '@libs/Statistics/trends/percentileBand';

describe('percentileBand', () => {
  test('returns null below 4 elements', () => {
    expect(percentileBand([])).toBeNull();
    expect(percentileBand([1])).toBeNull();
    expect(percentileBand([1, 2, 3])).toBeNull();
  });

  test('computes p25 / p75 over the whole series when window >= n', () => {
    const band = percentileBand([1, 2, 3, 4]);
    expect(band).not.toBeNull();
    if (!band) return;
    // numpy percentile([1,2,3,4], [25,75], linear) -> [1.75, 3.25]
    expect(band.p25).toBeCloseTo(1.75, 6);
    expect(band.p75).toBeCloseTo(3.25, 6);
  });

  test('uses only the last `window` entries', () => {
    const series = [100, 100, 100, 100, 1, 2, 3, 4];
    const band = percentileBand(series, 4);
    expect(band).not.toBeNull();
    if (!band) return;
    expect(band.p25).toBeCloseTo(1.75, 6);
    expect(band.p75).toBeCloseTo(3.25, 6);
  });
});
