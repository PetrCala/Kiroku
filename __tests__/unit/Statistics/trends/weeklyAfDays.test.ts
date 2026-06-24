/**
 * @jest-environment node
 */

import buildWeeklyAfDays, {
  summarizeWeeklyAfDays,
} from '@libs/Statistics/trends/weeklyAfDays';
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

// 2026-05-04 is a Monday, so 05-04..05-10 and 05-11..05-17 are two whole ISO
// weeks — convenient for asserting per-week buckets without boundary effects.
describe('buildWeeklyAfDays', () => {
  test('returns empty array when end is before start', () => {
    expect(
      buildWeeklyAfDays([], new Date('2026-05-05'), new Date('2026-05-04')),
    ).toEqual([]);
  });

  test('buckets alcohol-free days into their ISO week (out of 7)', () => {
    const out = buildWeeklyAfDays(
      [event('2026-05-05'), event('2026-05-06'), event('2026-05-12')],
      new Date('2026-05-04T00:00:00.000Z'),
      new Date('2026-05-17T00:00:00.000Z'),
    );
    expect(out).toHaveLength(2);
    // Week A: 2 drinking days -> 5 AF; week B: 1 drinking day -> 6 AF.
    expect(out.map(p => p.afDays)).toEqual([5, 6]);
    expect(out.map(p => p.daysInRange)).toEqual([7, 7]);
  });

  test('boundary weeks report only the days inside the window', () => {
    const out = buildWeeklyAfDays(
      [],
      new Date('2026-05-06T00:00:00.000Z'),
      new Date('2026-05-12T00:00:00.000Z'),
    );
    // Week A keeps Wed..Sun (5 days), week B keeps Mon..Tue (2 days).
    expect(out.map(p => p.daysInRange)).toEqual([5, 2]);
    expect(out.map(p => p.afDays)).toEqual([5, 2]);
  });
});

describe('summarizeWeeklyAfDays', () => {
  test('reports all zeros for an empty series', () => {
    expect(summarizeWeeklyAfDays([])).toEqual({
      afDays: 0,
      totalDays: 0,
      ratePct: 0,
    });
  });

  test('sums across weeks and rounds the rate', () => {
    const series = buildWeeklyAfDays(
      [event('2026-05-05'), event('2026-05-06'), event('2026-05-12')],
      new Date('2026-05-04T00:00:00.000Z'),
      new Date('2026-05-17T00:00:00.000Z'),
    );
    // 11 alcohol-free of 14 days -> 78.57% -> 79%.
    expect(summarizeWeeklyAfDays(series)).toEqual({
      afDays: 11,
      totalDays: 14,
      ratePct: 79,
    });
  });
});
