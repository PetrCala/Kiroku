import {
  composeFilters,
  dateRange,
  drinkTypeSubset,
  excludeBlackouts,
  forUsers,
  weekdaysOnly,
  weekendsOnly,
} from '@libs/Statistics/filters';
import type {DrinkEvent} from '@libs/Statistics/types';

function event(overrides: Partial<DrinkEvent>): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's1',
    ts: Date.UTC(2024, 0, 15, 12),
    localDay: '2024-01-15',
    localIsoWeek: '2024-W03',
    localMonth: '2024-01',
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

describe('dateRange', () => {
  const start = Date.UTC(2024, 0, 10);
  const end = Date.UTC(2024, 0, 20);
  const filter = dateRange(start, end);

  it('includes events at both inclusive endpoints', () => {
    expect(filter(event({ts: start}))).toBe(true);
    expect(filter(event({ts: end}))).toBe(true);
  });

  it('includes events inside the range', () => {
    expect(filter(event({ts: Date.UTC(2024, 0, 15)}))).toBe(true);
  });

  it('rejects events outside the range', () => {
    expect(filter(event({ts: start - 1}))).toBe(false);
    expect(filter(event({ts: end + 1}))).toBe(false);
  });
});

describe('drinkTypeSubset', () => {
  it('accepts an array of keys', () => {
    const filter = drinkTypeSubset(['beer', 'wine']);
    expect(filter(event({drinkKey: 'beer'}))).toBe(true);
    expect(filter(event({drinkKey: 'wine'}))).toBe(true);
    expect(filter(event({drinkKey: 'cocktail'}))).toBe(false);
  });

  it('accepts a Set of keys', () => {
    const filter = drinkTypeSubset(new Set(['cocktail']));
    expect(filter(event({drinkKey: 'cocktail'}))).toBe(true);
    expect(filter(event({drinkKey: 'beer'}))).toBe(false);
  });
});

describe('weekendsOnly / weekdaysOnly', () => {
  it('weekendsOnly matches events flagged as weekend', () => {
    expect(weekendsOnly(event({isWeekend: true}))).toBe(true);
    expect(weekendsOnly(event({isWeekend: false}))).toBe(false);
  });

  it('weekdaysOnly is the inverse of weekendsOnly', () => {
    expect(weekdaysOnly(event({isWeekend: false}))).toBe(true);
    expect(weekdaysOnly(event({isWeekend: true}))).toBe(false);
  });
});

describe('excludeBlackouts', () => {
  it('keeps non-blackout events', () => {
    expect(excludeBlackouts(event({blackoutSession: false}))).toBe(true);
  });

  it('drops blackout events', () => {
    expect(excludeBlackouts(event({blackoutSession: true}))).toBe(false);
  });
});

describe('forUsers', () => {
  it('accepts an array of user ids', () => {
    const filter = forUsers(['alice', 'bob']);
    expect(filter(event({userId: 'alice'}))).toBe(true);
    expect(filter(event({userId: 'carol'}))).toBe(false);
  });

  it('accepts a Set of user ids', () => {
    const filter = forUsers(new Set(['carol']));
    expect(filter(event({userId: 'carol'}))).toBe(true);
    expect(filter(event({userId: 'alice'}))).toBe(false);
  });
});

describe('composeFilters', () => {
  it('returns undefined when all inputs are undefined', () => {
    expect(composeFilters(undefined, undefined)).toBeUndefined();
  });

  it('returns the lone filter when only one is provided', () => {
    const only = weekendsOnly;
    expect(composeFilters(undefined, only)).toBe(only);
  });

  it('ANDs multiple filters', () => {
    const filter = composeFilters(weekendsOnly, drinkTypeSubset(['beer']));
    expect(filter?.(event({isWeekend: true, drinkKey: 'beer'}))).toBe(true);
    expect(filter?.(event({isWeekend: false, drinkKey: 'beer'}))).toBe(false);
    expect(filter?.(event({isWeekend: true, drinkKey: 'wine'}))).toBe(false);
  });

  it('short-circuits on the first failing predicate', () => {
    let secondCalled = false;
    const composed = composeFilters(
      () => false,
      () => {
        secondCalled = true;
        return true;
      },
    );
    composed?.(event({}));
    expect(secondCalled).toBe(false);
  });
});
