/**
 * @jest-environment node
 */

import {percentile} from '@src/libs/Statistics/stats';

describe('percentile', () => {
  const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  test('returns NaN for empty input', () => {
    expect(percentile([], 0.5)).toBeNaN();
  });

  test('q = 0 returns the minimum', () => {
    expect(percentile([7, 1, 5, 3, 9], 0)).toBe(1);
  });

  test('q = 1 returns the maximum', () => {
    expect(percentile([7, 1, 5, 3, 9], 1)).toBe(9);
  });

  test('q = 0.5 on odd-length series returns the middle element', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  test('q = 0.5 on even-length series returns mean of the two middle elements', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  test('q = 0.25 / 0.5 / 0.75 / 0.9 on [1..10] match numpy.percentile defaults', () => {
    // Reference values from numpy.percentile([1..10], [25, 50, 75, 90])
    expect(percentile(ten, 0.25)).toBeCloseTo(3.25, 10);
    expect(percentile(ten, 0.5)).toBeCloseTo(5.5, 10);
    expect(percentile(ten, 0.75)).toBeCloseTo(7.75, 10);
    expect(percentile(ten, 0.9)).toBeCloseTo(9.1, 10);
  });

  test('n = 1 returns that single value for any q', () => {
    [0, 0.25, 0.5, 0.75, 1].forEach(q => {
      expect(percentile([42], q)).toBe(42);
    });
  });

  test('n = 2 with q = 0.5 returns the midpoint', () => {
    expect(percentile([10, 20], 0.5)).toBe(15);
  });

  test('q outside [0, 1] is clamped', () => {
    expect(percentile(ten, -1)).toBe(1);
    expect(percentile(ten, 2)).toBe(10);
  });

  test('does not mutate the input array', () => {
    const input = [5, 2, 8, 1, 4];
    const snapshot = [...input];
    percentile(input, 0.5);
    expect(input).toEqual(snapshot);
  });
});
