/**
 * @jest-environment node
 */

import buildAfRateSeries from '@libs/Statistics/trends/afRate';
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

describe('buildAfRateSeries', () => {
  test('returns empty array when end is before start', () => {
    expect(
      buildAfRateSeries([], new Date('2026-05-02'), new Date('2026-05-01')),
    ).toEqual([]);
  });

  test('100% on an all-alcohol-free window', () => {
    const out = buildAfRateSeries(
      [],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-04T00:00:00.000Z'),
      30,
    );
    expect(out.map(p => p.rate)).toEqual([100, 100, 100, 100]);
  });

  test('pre-roll gives the first point a full trailing window', () => {
    // Window = 3. With no events anywhere, the first point already averages the
    // two pre-roll days plus itself (all alcohol-free) -> a flat 100, never a
    // one-day 0/100 spike.
    const out = buildAfRateSeries(
      [],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-03T00:00:00.000Z'),
      3,
    );
    expect(out.map(p => p.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
    expect(out.map(p => p.rate)).toEqual([100, 100, 100]);
  });

  test('a drink just before the range carries into the first point', () => {
    // Window = 3, range 05-10..05-12, with one drink the day before start.
    // First point window = [05-08, 05-09(drink), 05-10] -> 2/3 = 67, not 100.
    const out = buildAfRateSeries(
      [event('2026-05-09')],
      new Date('2026-05-10T00:00:00.000Z'),
      new Date('2026-05-12T00:00:00.000Z'),
      3,
    );
    expect(out.map(p => p.date)).toEqual([
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
    ]);
    // 05-10:[08,09,10]=2/3=67, 05-11:[09,10,11]=2/3=67, 05-12:[10,11,12]=3/3=100
    expect(out.map(p => p.rate)).toEqual([67, 67, 100]);
  });

  test('rate falls during drinking and recovers during abstinence', () => {
    // Window = 3. Drinks on days 2,3,4; clean afterwards. Pre-roll fills the
    // first window with alcohol-free days before 05-01.
    const out = buildAfRateSeries(
      [event('2026-05-02'), event('2026-05-03'), event('2026-05-04')],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-08T00:00:00.000Z'),
      3,
    );
    // 05-01:[04-29,04-30,05-01]3/3=100, 05-02:[04-30,05-01,05-02]2/3=67,
    // 05-03:1/3=33, 05-04:0/3=0, 05-05:1/3=33, 05-06:2/3=67, 05-07:3/3=100,
    // 05-08:3/3=100
    expect(out.map(p => p.rate)).toEqual([100, 67, 33, 0, 33, 67, 100, 100]);
  });
});
