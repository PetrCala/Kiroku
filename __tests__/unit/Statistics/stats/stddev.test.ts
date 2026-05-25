/**
 * @jest-environment node
 */

import {mean, stddev} from '@src/libs/Statistics/stats';

describe('stddev', () => {
  test('empty input returns 0', () => {
    expect(stddev([])).toBe(0);
  });

  test('single-value input returns 0', () => {
    expect(stddev([42])).toBe(0);
  });

  test('constant series returns 0', () => {
    expect(stddev([7, 7, 7, 7, 7])).toBe(0);
  });

  test('matches numpy std(ddof=1) on a known series', () => {
    // Reference: numpy.std([2, 4, 4, 4, 5, 5, 7, 9], ddof=1) ≈ 2.13809
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 5);
  });

  test('matches numpy std(ddof=1) on [1..10]', () => {
    // Reference: numpy.std(range(1,11), ddof=1) ≈ 3.02765
    expect(stddev([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeCloseTo(3.02765, 5);
  });
});

describe('mean', () => {
  test('empty input returns 0', () => {
    expect(mean([])).toBe(0);
  });

  test('arithmetic mean of [1, 2, 3, 4] is 2.5', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  test('handles negative and positive values', () => {
    expect(mean([-5, 0, 5])).toBe(0);
  });
});
