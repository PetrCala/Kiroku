import {
  countDays,
  countEvents,
  countSessions,
  firstEvent,
  lastEvent,
  meanUnits,
  medianUnits,
  p25,
  p75,
  p90,
  stddev,
  sumSdu,
  sumUnits,
} from '@libs/Statistics/reducers';
import type {DrinkEvent} from '@libs/Statistics/types';

function event(overrides: Partial<DrinkEvent>): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's1',
    ts: 0,
    localDay: '2024-01-15',
    localIsoWeek: '2024-W03',
    localMonth: '2024-01',
    localHour: 12,
    localDow: 0,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 0,
    blackoutSession: false,
    ...overrides,
  };
}

function withUnits(values: number[]): DrinkEvent[] {
  return values.map(v => event({units: v}));
}

describe('sumUnits / sumSdu / countEvents', () => {
  it('sumUnits adds units across events', () => {
    expect(sumUnits(withUnits([1, 2, 3]))).toBe(6);
  });

  it('sumUnits is 0 for empty input', () => {
    expect(sumUnits([])).toBe(0);
  });

  it('sumSdu treats missing sdu as 0', () => {
    expect(
      sumSdu([event({sdu: 1.5}), event({sdu: undefined}), event({sdu: 2})]),
    ).toBe(3.5);
  });

  it('countEvents returns array length', () => {
    expect(countEvents(withUnits([1, 2, 3]))).toBe(3);
    expect(countEvents([])).toBe(0);
  });
});

describe('countSessions / countDays', () => {
  it('countSessions counts unique session ids', () => {
    expect(
      countSessions([
        event({sessionId: 'a'}),
        event({sessionId: 'a'}),
        event({sessionId: 'b'}),
      ]),
    ).toBe(2);
  });

  it('countDays counts unique localDay values', () => {
    expect(
      countDays([
        event({localDay: '2024-01-15'}),
        event({localDay: '2024-01-15'}),
        event({localDay: '2024-01-16'}),
      ]),
    ).toBe(2);
  });
});

describe('meanUnits / medianUnits', () => {
  it('meanUnits is 0 for empty input', () => {
    expect(meanUnits([])).toBe(0);
  });

  it('meanUnits averages units', () => {
    expect(meanUnits(withUnits([1, 2, 3, 4]))).toBe(2.5);
  });

  it('medianUnits returns the middle for odd length', () => {
    expect(medianUnits(withUnits([1, 3, 9]))).toBe(3);
  });

  it('medianUnits interpolates between two middles for even length', () => {
    expect(medianUnits(withUnits([1, 2, 3, 4]))).toBe(2.5);
  });

  it('medianUnits is 0 for empty input', () => {
    expect(medianUnits([])).toBe(0);
  });
});

describe('percentiles', () => {
  it('p25 / p75 / p90 use linear interpolation', () => {
    // numpy.percentile([1,2,3,4,5], [25, 75, 90]) → [2.0, 4.0, 4.6]
    const events = withUnits([1, 2, 3, 4, 5]);
    expect(p25(events)).toBeCloseTo(2.0, 6);
    expect(p75(events)).toBeCloseTo(4.0, 6);
    expect(p90(events)).toBeCloseTo(4.6, 6);
  });

  it('percentiles return the only value for a single-element bucket', () => {
    const events = withUnits([7]);
    expect(p25(events)).toBe(7);
    expect(p75(events)).toBe(7);
    expect(p90(events)).toBe(7);
    expect(medianUnits(events)).toBe(7);
  });

  it('percentiles return 0 for empty input', () => {
    expect(p25([])).toBe(0);
    expect(p75([])).toBe(0);
    expect(p90([])).toBe(0);
  });
});

describe('stddev', () => {
  it('is 0 for empty input', () => {
    expect(stddev([])).toBe(0);
  });

  it('is 0 for a single-element bucket', () => {
    expect(stddev(withUnits([5]))).toBe(0);
  });

  it('matches the population stddev', () => {
    // population stddev of [2,4,4,4,5,5,7,9] is 2.0
    expect(stddev(withUnits([2, 4, 4, 4, 5, 5, 7, 9]))).toBeCloseTo(2.0, 6);
  });
});

describe('firstEvent / lastEvent', () => {
  it('return undefined for empty input', () => {
    expect(firstEvent([])).toBeUndefined();
    expect(lastEvent([])).toBeUndefined();
  });

  it('pick the min / max by ts', () => {
    const a = event({ts: 100, sessionId: 'a'});
    const b = event({ts: 50, sessionId: 'b'});
    const c = event({ts: 200, sessionId: 'c'});
    expect(firstEvent([a, b, c])?.sessionId).toBe('b');
    expect(lastEvent([a, b, c])?.sessionId).toBe('c');
  });

  it('keep the first occurrence on ties', () => {
    const a = event({ts: 100, sessionId: 'a'});
    const b = event({ts: 100, sessionId: 'b'});
    expect(firstEvent([a, b])?.sessionId).toBe('a');
    expect(lastEvent([a, b])?.sessionId).toBe('a');
  });
});
