/**
 * @jest-environment node
 */

import {ewma} from '@src/libs/Statistics/stats';

describe('ewma', () => {
  test('returns empty array for empty input', () => {
    expect(ewma([])).toEqual([]);
  });

  test('seed equals mean of first 4 values when n >= 4', () => {
    const series = [10, 20, 30, 40, 100, 200, 300];
    const result = ewma(series, 0.3);
    // (10 + 20 + 30 + 40) / 4 = 25
    expect(result[0]).toBeCloseTo(25, 10);
  });

  test('seed equals mean of all values when n < 4', () => {
    expect(ewma([8])[0]).toBeCloseTo(8, 10);
    expect(ewma([4, 6])[0]).toBeCloseTo(5, 10);
    expect(ewma([3, 6, 9])[0]).toBeCloseTo(6, 10);
  });

  test('lambda = 0 returns a flat array at the seed value', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8];
    const seed = (1 + 2 + 3 + 4) / 4; // 2.5
    const result = ewma(series, 0);
    expect(result).toHaveLength(series.length);
    result.forEach(v => expect(v).toBeCloseTo(seed, 10));
  });

  test('lambda = 1 yields seed at index 0 and identity copy from index 1', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8];
    const seed = 2.5;
    const result = ewma(series, 1);
    expect(result[0]).toBeCloseTo(seed, 10);
    for (let i = 1; i < series.length; i += 1) {
      expect(result[i]).toBeCloseTo(series[i], 10);
    }
  });

  test('smoothed series is bounded by the input min and max', () => {
    const series = [1, 5, 3, 7, 2, 8, 4, 6, 9, 5];
    const inputMin = Math.min(...series);
    const inputMax = Math.max(...series);
    const result = ewma(series, 0.3);
    result.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(inputMin);
      expect(v).toBeLessThanOrEqual(inputMax);
    });
  });

  test('default lambda is 0.3', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(ewma(series)).toEqual(ewma(series, 0.3));
  });
});
