import {
  selectAfDaysThisMonth,
  selectHasEverLogged,
  selectIsSparse,
  selectThisMonthHeatmapCells,
  selectTrendSeries,
  selectWeeklyKpis,
} from '@libs/Statistics/overviewSelectors';
import type {DrinkEvent} from '@libs/Statistics/types';

function event(overrides: Partial<DrinkEvent>): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's-default',
    ts: new Date('2026-05-25T12:00:00Z').getTime(),
    localDay: '2026-05-25',
    localIsoWeek: '2026-W22',
    localMonth: '2026-05',
    localHour: 12,
    localDow: 0,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 1,
    blackoutSession: false,
    ...overrides,
  };
}

describe('selectAfDaysThisMonth', () => {
  it('clamps the denominator to elapsed days on day 1 of a month', () => {
    // 2026-05-01 with zero events: 1/1, never 1/31.
    const now = new Date(2026, 4, 1, 9, 0, 0);
    expect(selectAfDaysThisMonth([], now)).toEqual({value: 1, total: 1});
  });

  it('counts elapsed-only when there is no data mid-month', () => {
    const now = new Date(2026, 4, 25, 23, 30, 0);
    expect(selectAfDaysThisMonth([], now)).toEqual({value: 25, total: 25});
  });

  it('subtracts distinct drink-days, not raw events', () => {
    const now = new Date(2026, 4, 25, 23, 30, 0);
    const events = [
      event({localDay: '2026-05-03', sessionId: 's1'}),
      event({localDay: '2026-05-03', sessionId: 's1'}),
      event({localDay: '2026-05-10', sessionId: 's2'}),
    ];
    expect(selectAfDaysThisMonth(events, now)).toEqual({value: 23, total: 25});
  });
});

describe('selectThisMonthHeatmapCells', () => {
  it('marks cells past today as isFuture and renders them with intensity 0', () => {
    const now = new Date(2026, 4, 5, 12, 0, 0); // 2026-05-05
    const cells = selectThisMonthHeatmapCells([], now);
    expect(cells).toHaveLength(31);
    const may1 = cells.find(c => c.dateKey === '2026-05-01');
    const may10 = cells.find(c => c.dateKey === '2026-05-10');
    expect(may1?.isFuture).toBe(false);
    expect(may1?.intensity).toBe(0);
    expect(may10?.isFuture).toBe(true);
    expect(may10?.intensity).toBe(0);
  });

  it('only ramps intensity against this-month days, not historical ones', () => {
    const now = new Date(2026, 4, 25, 12, 0, 0);
    const events = [
      event({
        localDay: '2026-05-10',
        localMonth: '2026-05',
        sdu: 4,
        units: 4,
      }),
      // Way-higher SDU from an earlier month must not depress this-month
      // intensity below the top of the ramp.
      event({
        localDay: '2026-03-10',
        localMonth: '2026-03',
        sdu: 200,
        units: 200,
      }),
    ];
    const cells = selectThisMonthHeatmapCells(events, now);
    const may10 = cells.find(c => c.dateKey === '2026-05-10');
    expect(may10?.totalSdu).toBe(4);
    expect(may10?.intensity).toBeGreaterThan(0);
  });
});

describe('selectWeeklyKpis', () => {
  it('clamps this-week quiet days to elapsed days', () => {
    // 2026-05-25 is a Monday. Only 1 elapsed day in the current ISO week.
    const now = new Date(2026, 4, 25, 12, 0, 0);
    const kpis = selectWeeklyKpis([], now);
    expect(kpis.quietDaysThisWeek).toBe(1);
    // Last week (May 18-24) has full 7 elapsed.
    expect(kpis.quietDaysLastWeek).toBe(7);
  });

  it('counts sessions and units per ISO week label', () => {
    const now = new Date(2026, 4, 25, 12, 0, 0);
    const events = [
      event({
        localIsoWeek: '2026-W22',
        sessionId: 's-a',
        units: 2,
      }),
      event({
        localIsoWeek: '2026-W22',
        sessionId: 's-b',
        units: 3,
      }),
      event({
        localIsoWeek: '2026-W21',
        sessionId: 's-c',
        units: 1,
      }),
    ];
    const kpis = selectWeeklyKpis(events, now);
    expect(kpis.sessionsThisWeek).toBe(2);
    expect(kpis.unitsThisWeek).toBe(5);
    expect(kpis.sessionsLastWeek).toBe(1);
    expect(kpis.unitsLastWeek).toBe(1);
  });
});

describe('selectTrendSeries', () => {
  it('returns 8 contiguous points oldest → newest with zero-fill', () => {
    const now = new Date(2026, 4, 25, 12, 0, 0);
    const series = selectTrendSeries([], now);
    expect(series.points).toHaveLength(8);
    expect(series.weeksWithData).toBe(0);
    // No events ⇒ Mann–Kendall returns 'none' regardless of n.
    expect(series.mannKendall.trend).toBe('none');
  });

  it('counts weeks with data and produces a band', () => {
    const now = new Date(2026, 4, 25, 12, 0, 0);
    const events = [
      event({localIsoWeek: '2026-W22', units: 5}),
      event({localIsoWeek: '2026-W21', units: 4}),
      event({localIsoWeek: '2026-W20', units: 3}),
      event({localIsoWeek: '2026-W19', units: 2}),
      event({localIsoWeek: '2026-W18', units: 1}),
    ];
    const series = selectTrendSeries(events, now);
    expect(series.weeksWithData).toBe(5);
    expect(series.band.p25).toBeGreaterThanOrEqual(0);
    expect(series.band.p75).toBeGreaterThanOrEqual(series.band.p25);
    expect(series.ewma).toHaveLength(8);
  });
});

describe('selectIsSparse / selectHasEverLogged', () => {
  it('treats <4 weeks of data as sparse', () => {
    expect(selectIsSparse([event({})], 3)).toBe(true);
    expect(selectIsSparse([event({})], 4)).toBe(false);
  });

  it('treats zero events as sparse regardless of weeks count', () => {
    expect(selectIsSparse([], 10)).toBe(true);
  });

  it('hasEverLogged flips on the first event', () => {
    expect(selectHasEverLogged([])).toBe(false);
    expect(selectHasEverLogged([event({})])).toBe(true);
  });
});
