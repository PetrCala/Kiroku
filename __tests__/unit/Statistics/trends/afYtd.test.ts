/**
 * @jest-environment node
 */

import buildAfYtdSeries from '@libs/Statistics/trends/afYtd';
import type {DrinkEvent} from '@libs/Statistics';

function event(localDay: string): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's1',
    ts: new Date(`${localDay}T12:00:00.000Z`).getTime(),
    localDay,
    localIsoWeek: '2026-W01',
    localMonth: localDay.slice(0, 7),
    localHour: 12,
    localDow: 0,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 1,
    blackoutSession: false,
  };
}

describe('buildAfYtdSeries', () => {
  test('returns empty array when end is before start', () => {
    const out = buildAfYtdSeries(
      [],
      new Date('2026-05-02'),
      new Date('2026-05-01'),
    );
    expect(out).toEqual([]);
  });

  test('counts up by one for each day with no events', () => {
    const out = buildAfYtdSeries(
      [],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-04T00:00:00.000Z'),
    );
    expect(out.map(p => p.count)).toEqual([1, 2, 3, 4]);
    expect(out.map(p => p.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
    ]);
  });

  test('day with events does not increment the counter', () => {
    const out = buildAfYtdSeries(
      [event('2026-05-02')],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-04T00:00:00.000Z'),
    );
    expect(out.map(p => p.count)).toEqual([1, 1, 2, 3]);
  });

  test('resets to zero on Jan 1', () => {
    const out = buildAfYtdSeries(
      [],
      new Date('2025-12-30T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );
    // 2025-12-30 -> 1, 2025-12-31 -> 2, 2026-01-01 -> reset then +1 -> 1,
    // 2026-01-02 -> 2.
    expect(out.map(p => p.count)).toEqual([1, 2, 1, 2]);
  });
});
