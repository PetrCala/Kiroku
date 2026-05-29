import {
  buildPeriodSummary,
  buildSubPeriodSeries,
  dayKeysInRange,
  monthKeysInRange,
  pickGranularity,
} from '@libs/Statistics/overview';
import type {Range} from '@components/StatsContextProvider/types';
import type {RangePreset} from '@src/types/onyx/StatisticsFilters';
import type {DrinkEvent} from '@libs/Statistics/types';

const THRESHOLDS = {yellow: 5, orange: 10};

/** Local-time event so day keys and `dateRange(ts)` agree regardless of TZ. */
function event(
  localDay: string,
  units: number,
  overrides?: Partial<DrinkEvent>,
): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: `s-${localDay}`,
    ts: new Date(`${localDay}T12:00:00`).getTime(),
    localDay,
    localIsoWeek: '2026-W01',
    localMonth: localDay.slice(0, 7),
    localHour: 12,
    localDow: 0,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units,
    blackoutSession: false,
    ...overrides,
  };
}

function makeRange(preset: RangePreset, start: Date, end: Date): Range {
  return {
    start,
    end,
    preset,
    offset: 0,
    isPageable: false,
    canGoPrev: false,
    canGoNext: false,
    isLatest: true,
  };
}

// Full January 2026 already elapsed.
const JAN_START = new Date(2026, 0, 1, 0, 0, 0);
const JAN_END = new Date(2026, 0, 31, 23, 59, 59);
const AFTER_JAN = new Date(2026, 1, 15, 12, 0, 0);

describe('buildPeriodSummary', () => {
  it('treats an empty window as all alcohol-free, one long dry streak', () => {
    const s = buildPeriodSummary([], JAN_START, JAN_END, AFTER_JAN, THRESHOLDS);
    expect(s.elapsedDays).toBe(31);
    expect(s.afDays).toBe(31);
    expect(s.distribution.green).toBe(31);
    expect(s.longestDryStreak).toBe(31);
    expect(s.totalUnits).toBe(0);
    expect(s.drinkingDays).toBe(0);
    expect(s.avgUnitsPerDrinkingDay).toBe(0);
    expect(s.sessions).toBe(0);
  });

  it('buckets days into bands at the exact threshold boundaries', () => {
    const events = [
      event('2026-01-02', 5), // == yellow → yellow band
      event('2026-01-03', 10), // == orange → orange band
      event('2026-01-04', 11), // > orange → red band
      event('2026-01-05', 3), // ≤ yellow → yellow band
    ];
    const s = buildPeriodSummary(
      events,
      JAN_START,
      JAN_END,
      AFTER_JAN,
      THRESHOLDS,
    );
    expect(s.distribution).toEqual({green: 27, yellow: 2, orange: 1, red: 1});
    expect(s.daysOverYellow).toBe(2); // orange + red
    expect(s.daysOverOrange).toBe(1); // red
    expect(s.drinkingDays).toBe(4);
    expect(s.heaviestDay).toBe(11);
    expect(s.totalUnits).toBe(29);
    expect(s.avgUnitsPerDrinkingDay).toBeCloseTo(29 / 4);
    expect(s.sessions).toBe(4);
  });

  it('finds the longest run of consecutive dry days', () => {
    const events = [event('2026-01-05', 2), event('2026-01-20', 2)];
    const s = buildPeriodSummary(
      events,
      JAN_START,
      JAN_END,
      AFTER_JAN,
      THRESHOLDS,
    );
    // Gaps: 1-4 (4), 6-19 (14), 21-31 (11) → longest 14.
    expect(s.longestDryStreak).toBe(14);
    expect(s.drinkingDays).toBe(2);
    expect(s.afDays).toBe(29);
  });

  it('clamps elapsed days and totals to `now` for a partial period', () => {
    const now = new Date(2026, 0, 10, 12, 0, 0);
    const s = buildPeriodSummary(
      [event('2026-01-25', 8)], // after `now` → excluded
      JAN_START,
      JAN_END,
      now,
      THRESHOLDS,
    );
    expect(s.elapsedDays).toBe(10);
    expect(s.totalUnits).toBe(0);
    expect(s.afDays).toBe(10);
  });

  it('sums multiple sessions on one day before banding it', () => {
    const events = [
      event('2026-01-02', 3),
      event('2026-01-02', 4, {sessionId: 's-other'}),
    ];
    const s = buildPeriodSummary(
      events,
      JAN_START,
      JAN_END,
      AFTER_JAN,
      THRESHOLDS,
    );
    expect(s.totalUnits).toBe(7);
    expect(s.heaviestDay).toBe(7);
    expect(s.drinkingDays).toBe(1);
    expect(s.distribution.orange).toBe(1); // 5 < 7 ≤ 10
    expect(s.sessions).toBe(2);
  });

  it('returns an empty summary when the whole window is in the future', () => {
    const future = makeRange('M', new Date(2027, 0, 1), new Date(2027, 0, 31));
    const s = buildPeriodSummary(
      [],
      future.start,
      future.end,
      AFTER_JAN,
      THRESHOLDS,
    );
    expect(s.elapsedDays).toBe(0);
    expect(s.afDays).toBe(0);
  });
});

describe('pickGranularity', () => {
  const r = (preset: RangePreset, days = 1) =>
    makeRange(preset, new Date(2026, 0, 1), new Date(2026, 0, 1 + days));

  it('maps presets to sub-period granularity', () => {
    expect(pickGranularity(r('W'))).toBe('day');
    expect(pickGranularity(r('M'))).toBe('week');
    expect(pickGranularity(r('6M'))).toBe('month');
    expect(pickGranularity(r('Y'))).toBe('month');
    expect(pickGranularity(r('All'))).toBe('year');
  });

  it('falls back to span length for Custom', () => {
    expect(pickGranularity(r('Custom', 10))).toBe('day');
    expect(pickGranularity(r('Custom', 60))).toBe('week');
    expect(pickGranularity(r('Custom', 200))).toBe('month');
    expect(pickGranularity(r('Custom', 2000))).toBe('year');
  });
});

describe('buildSubPeriodSeries', () => {
  it('returns one gap-filled point per day for a Week range', () => {
    const start = new Date(2026, 0, 5, 0, 0, 0);
    const end = new Date(2026, 0, 11, 23, 59, 59);
    const range = makeRange('W', start, end);
    const series = buildSubPeriodSeries(
      [event('2026-01-06', 4)],
      range,
      AFTER_JAN,
    );
    expect(series).toHaveLength(7);
    expect(series.reduce((sum, p) => sum + p.units, 0)).toBe(4);
    expect(series.filter(p => p.units === 0)).toHaveLength(6);
  });
});

describe('key helpers', () => {
  it('dayKeysInRange covers every calendar day inclusively', () => {
    expect(dayKeysInRange(JAN_START, JAN_END)).toHaveLength(31);
  });

  it('monthKeysInRange covers every month inclusively', () => {
    expect(
      monthKeysInRange(new Date(2026, 0, 15), new Date(2026, 3, 2)),
    ).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });
});
