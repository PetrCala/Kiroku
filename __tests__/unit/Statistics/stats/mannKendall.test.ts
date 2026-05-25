/**
 * @jest-environment node
 */

import {mannKendall} from '@src/libs/Statistics/stats';

describe('mannKendall', () => {
  test('empty input returns neutral result', () => {
    const r = mannKendall([]);
    expect(r.tau).toBe(0);
    expect(r.sScore).toBe(0);
    expect(r.p).toBe(1);
    expect(r.trend).toBe('none');
  });

  test('n < 8 always returns trend: none regardless of monotonicity', () => {
    for (let n = 0; n < 8; n += 1) {
      const series = Array.from({length: n}, (_, i) => i + 1);
      expect(mannKendall(series).trend).toBe('none');
    }
  });

  test('perfect monotonic increasing (n=10) → tau=1, sScore=45, trend=up', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const r = mannKendall(series);
    expect(r.sScore).toBe(45);
    expect(r.tau).toBeCloseTo(1, 10);
    expect(r.p).toBeLessThan(0.05);
    expect(r.trend).toBe('up');
  });

  test('perfect monotonic decreasing (n=10) → tau=-1, sScore=-45, trend=down', () => {
    const series = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const r = mannKendall(series);
    expect(r.sScore).toBe(-45);
    expect(r.tau).toBeCloseTo(-1, 10);
    expect(r.p).toBeLessThan(0.05);
    expect(r.trend).toBe('down');
  });

  test('flat constant series (n=10) → tau=0, sScore=0, p=1, trend=none', () => {
    const r = mannKendall([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    expect(r.sScore).toBe(0);
    expect(r.tau).toBe(0);
    expect(r.p).toBe(1);
    expect(r.trend).toBe('none');
  });

  test('near-monotone with a single inversion (n=12) still trends up', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 11];
    const r = mannKendall(series);
    expect(r.sScore).toBe(64); // 66 pairs, one inversion contributes -1 (net -2 vs all-positive)
    expect(r.p).toBeLessThan(0.05);
    expect(r.trend).toBe('up');
  });

  test('noisy series with p > 0.05 returns trend: none even when sScore > 0', () => {
    // [1,5,2,6,3,7,4,8] gives S=16, Z≈1.86, p≈0.063 — just above the gate.
    const r = mannKendall([1, 5, 2, 6, 3, 7, 4, 8]);
    expect(r.sScore).toBe(16);
    expect(r.p).toBeGreaterThan(0.05);
    expect(r.trend).toBe('none');
  });

  test('tie correction: tied series has smaller |tau| than tie-free counterpart', () => {
    const tieFree = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const tied = [1, 2, 3, 4, 5, 5, 7, 8, 9, 10];
    const tauFree = Math.abs(mannKendall(tieFree).tau);
    const tauTied = Math.abs(mannKendall(tied).tau);
    expect(tauFree).toBeCloseTo(1, 10);
    expect(tauTied).toBeLessThan(tauFree);
    // sanity: should still be very close to 1 (only one tied pair)
    expect(tauTied).toBeGreaterThan(0.95);
  });

  test('reference jagged-up series [10,12,11,14,13,16,15,18,17,20] (n=10)', () => {
    // Hand-computed: S = 37, Var = 125, Z = 36/sqrt(125) ≈ 3.2199, tau = 37/45 ≈ 0.8222.
    const r = mannKendall([10, 12, 11, 14, 13, 16, 15, 18, 17, 20]);
    expect(r.sScore).toBe(37);
    expect(r.tau).toBeCloseTo(37 / 45, 10);
    expect(r.p).toBeLessThan(0.005);
    expect(r.trend).toBe('up');
  });

  test('p is clamped into [0, 1]', () => {
    const r = mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.p).toBeGreaterThanOrEqual(0);
    expect(r.p).toBeLessThanOrEqual(1);
  });
});
