/**
 * @jest-environment node
 */

import shiftRange from '@libs/Statistics/trends/shiftRange';
import type {Range} from '@components/StatsContextProvider/types';

function makeRange(start: string, end: string): Range {
  return {
    start: new Date(start),
    end: new Date(end),
    preset: 'Custom',
  };
}

describe('shiftRange', () => {
  test('returns null for comparison=none', () => {
    expect(
      shiftRange(makeRange('2026-01-01', '2026-01-31'), 'none'),
    ).toBeNull();
  });

  test('previous-period returns same-length window placed before start', () => {
    const range = makeRange(
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T23:59:59.999Z',
    );
    const shifted = shiftRange(range, 'previous-period');
    expect(shifted).not.toBeNull();
    if (!shifted) {
      return;
    }
    const length = range.end.getTime() - range.start.getTime();
    expect(shifted.end.getTime()).toBe(range.start.getTime() - 1);
    expect(shifted.start.getTime()).toBe(range.start.getTime() - length - 1);
  });

  test('previous-year subtracts exactly one calendar year', () => {
    const range = makeRange(
      '2026-05-15T00:00:00.000Z',
      '2026-06-15T00:00:00.000Z',
    );
    const shifted = shiftRange(range, 'previous-year');
    expect(shifted?.start.toISOString()).toBe('2025-05-15T00:00:00.000Z');
    expect(shifted?.end.toISOString()).toBe('2025-06-15T00:00:00.000Z');
  });

  test('previous-year on Feb 29 rolls back to Feb 28', () => {
    const range = makeRange(
      '2024-02-29T00:00:00.000Z',
      '2024-02-29T23:59:59.999Z',
    );
    const shifted = shiftRange(range, 'previous-year');
    expect(shifted?.start.getUTCFullYear()).toBe(2023);
    expect(shifted?.start.getUTCMonth()).toBe(1); // February
    expect(shifted?.start.getUTCDate()).toBe(28);
  });
});
