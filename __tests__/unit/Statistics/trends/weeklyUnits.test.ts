/**
 * @jest-environment node
 */

import buildWeeklyUnits from '@libs/Statistics/trends/weeklyUnits';
import type {DrinkEvent} from '@libs/Statistics';

function event(overrides: Partial<DrinkEvent>): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's1',
    ts: 0,
    localDay: '2026-04-08',
    localIsoWeek: '2026-W15',
    localMonth: '2026-04',
    localHour: 12,
    localDow: 2,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 1,
    blackoutSession: false,
    ...overrides,
  };
}

describe('buildWeeklyUnits', () => {
  test('zero-fills weeks with no events', () => {
    // 2026-04-06 is Monday of ISO week 15; range covers 3 ISO weeks.
    const out = buildWeeklyUnits(
      [],
      new Date('2026-04-06T00:00:00.000Z'),
      new Date('2026-04-26T00:00:00.000Z'),
    );
    expect(out.map(p => p.units)).toEqual([0, 0, 0]);
    expect(out[0].isoWeek).toBe('2026-W15');
  });

  test('sums units within the event week', () => {
    const events = [
      event({
        ts: new Date('2026-04-08T12:00:00.000Z').getTime(),
        localIsoWeek: '2026-W15',
        units: 2,
      }),
      event({
        ts: new Date('2026-04-09T12:00:00.000Z').getTime(),
        localIsoWeek: '2026-W15',
        units: 3,
      }),
      event({
        ts: new Date('2026-04-15T12:00:00.000Z').getTime(),
        localIsoWeek: '2026-W16',
        units: 1,
      }),
    ];
    const out = buildWeeklyUnits(
      events,
      new Date('2026-04-06T00:00:00.000Z'),
      new Date('2026-04-26T00:00:00.000Z'),
    );
    expect(out.map(p => p.units)).toEqual([5, 1, 0]);
  });

  test('excludes events outside the range via the dateRange filter', () => {
    const events = [
      event({
        ts: new Date('2026-04-04T12:00:00.000Z').getTime(),
        localIsoWeek: '2026-W14',
        units: 10,
      }),
    ];
    const out = buildWeeklyUnits(
      events,
      new Date('2026-04-06T00:00:00.000Z'),
      new Date('2026-04-19T00:00:00.000Z'),
    );
    expect(out.every(p => p.units === 0)).toBe(true);
  });
});
