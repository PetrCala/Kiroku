/**
 * @jest-environment node
 */

import buildAfCumulativeSeries from '@libs/Statistics/trends/afCumulative';
import type {DrinkEvent} from '@libs/Statistics';

function event(localDay: string): DrinkEvent {
  const ts = new Date(`${localDay}T12:00:00.000Z`).getTime();
  return {
    userId: 'u1',
    sessionId: 's1',
    ts,
    anchorTs: ts,
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

describe('buildAfCumulativeSeries', () => {
  test('returns empty array when end is before start', () => {
    const out = buildAfCumulativeSeries(
      [],
      new Date('2026-05-02'),
      new Date('2026-05-01'),
    );
    expect(out).toEqual([]);
  });

  test('counts up by one for each day with no events', () => {
    const out = buildAfCumulativeSeries(
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
    const out = buildAfCumulativeSeries(
      [event('2026-05-02')],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-04T00:00:00.000Z'),
    );
    expect(out.map(p => p.count)).toEqual([1, 1, 2, 3]);
  });

  test('does not reset across a year boundary', () => {
    const out = buildAfCumulativeSeries(
      [],
      new Date('2025-12-30T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );
    // The counter keeps climbing across Jan 1 instead of resetting:
    // 2025-12-30 -> 1, 2025-12-31 -> 2, 2026-01-01 -> 3, 2026-01-02 -> 4.
    expect(out.map(p => p.count)).toEqual([1, 2, 3, 4]);
    expect(out.map(p => p.date)).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
  });
});
