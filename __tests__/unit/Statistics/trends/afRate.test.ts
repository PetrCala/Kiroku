/**
 * @jest-environment node
 */

import buildAfRateSeries, {
  summarizeAfRate,
} from '@libs/Statistics/trends/afRate';
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

  test('expanding window before it fills, then trailing', () => {
    // Window = 2 days. Drinks on day 2 and day 4.
    // day1: AF -> 1/1 = 100
    // day2: drink -> [d1,d2] = 1/2 = 50
    // day3: AF -> [d2,d3] = 1/2 = 50
    // day4: drink -> [d3,d4] = 1/2 = 50
    // day5: AF -> [d4,d5] = 1/2 = 50
    const out = buildAfRateSeries(
      [event('2026-05-02'), event('2026-05-04')],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-05T00:00:00.000Z'),
      2,
    );
    expect(out.map(p => p.rate)).toEqual([100, 50, 50, 50, 50]);
    expect(out[0].date).toBe('2026-05-01');
  });

  test('rate falls during drinking and recovers during abstinence', () => {
    // Window = 3. Drinks on days 2,3,4; clean afterwards.
    const out = buildAfRateSeries(
      [event('2026-05-02'), event('2026-05-03'), event('2026-05-04')],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-08T00:00:00.000Z'),
      3,
    );
    // d1:100, d2:[d1,d2]1/2=50, d3:[d1..d3]1/3=33, d4:[d2..d4]0/3=0,
    // d5:[d3..d5]1/3=33, d6:[d4..d6]2/3=67, d7:[d5..d7]3/3=100, d8:[d6..d8]3/3=100
    expect(out.map(p => p.rate)).toEqual([100, 50, 33, 0, 33, 67, 100, 100]);
  });
});

describe('summarizeAfRate', () => {
  test('reads the final point', () => {
    const out = buildAfRateSeries(
      [event('2026-05-02')],
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-03T00:00:00.000Z'),
      30,
    );
    // 2 alcohol-free of 3 elapsed days -> 67%.
    expect(summarizeAfRate(out)).toEqual({currentRate: 67});
  });

  test('reports zero for an empty series', () => {
    expect(summarizeAfRate([])).toEqual({currentRate: 0});
  });
});
