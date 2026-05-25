/**
 * @jest-environment node
 */

import * as stats from '@src/libs/Statistics/stats';
import type {MannKendallResult} from '@src/libs/Statistics/stats';

describe('stats barrel', () => {
  test('re-exports the public functions', () => {
    expect(typeof stats.ewma).toBe('function');
    expect(typeof stats.mannKendall).toBe('function');
    expect(typeof stats.percentile).toBe('function');
    expect(typeof stats.stddev).toBe('function');
    expect(typeof stats.mean).toBe('function');
  });

  test('MannKendallResult type is consumable', () => {
    const r: MannKendallResult = stats.mannKendall([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(r.trend).toBe('up');
  });
});
