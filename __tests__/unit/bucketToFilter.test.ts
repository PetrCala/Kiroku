import type {DrinkEvent} from '@libs/Statistics';
import {
  bucketToFilter,
  bucketToSessionFilter,
} from '@src/screens/Statistics/drilldown/bucketToFilter';

function makeEvent(overrides: Partial<DrinkEvent>): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's1',
    ts: 0,
    localDay: '2025-06-12',
    localIsoWeek: '2025-W24',
    localMonth: '2025-06',
    localHour: 12,
    localDow: 3,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 1,
    sdu: undefined,
    blackoutSession: false,
    sessionDurationMin: undefined,
    ...overrides,
  };
}

describe('bucketToFilter', () => {
  it('day matches by localDay', () => {
    const f = bucketToFilter({kind: 'day', date: '2025-06-12'});
    expect(f(makeEvent({localDay: '2025-06-12'}))).toBe(true);
    expect(f(makeEvent({localDay: '2025-06-13'}))).toBe(false);
  });

  it('isoWeek matches by localIsoWeek', () => {
    const f = bucketToFilter({kind: 'isoWeek', isoWeek: '2025-W24'});
    expect(f(makeEvent({localIsoWeek: '2025-W24'}))).toBe(true);
    expect(f(makeEvent({localIsoWeek: '2025-W25'}))).toBe(false);
  });

  it('month matches by localMonth', () => {
    const f = bucketToFilter({kind: 'month', month: '2025-06'});
    expect(f(makeEvent({localMonth: '2025-06'}))).toBe(true);
    expect(f(makeEvent({localMonth: '2025-07'}))).toBe(false);
  });

  it('hour matches by localHour', () => {
    const f = bucketToFilter({kind: 'hour', hour: 21});
    expect(f(makeEvent({localHour: 21}))).toBe(true);
    expect(f(makeEvent({localHour: 20}))).toBe(false);
  });

  it('dow matches by localDow', () => {
    const f = bucketToFilter({kind: 'dow', dow: 5});
    expect(f(makeEvent({localDow: 5}))).toBe(true);
    expect(f(makeEvent({localDow: 4}))).toBe(false);
  });

  it('dowHour matches when both fields agree', () => {
    const f = bucketToFilter({kind: 'dowHour', dow: 5, hour: 21});
    expect(f(makeEvent({localDow: 5, localHour: 21}))).toBe(true);
    expect(f(makeEvent({localDow: 5, localHour: 22}))).toBe(false);
    expect(f(makeEvent({localDow: 4, localHour: 21}))).toBe(false);
  });

  it('drinkType matches by drinkKey', () => {
    const f = bucketToFilter({kind: 'drinkType', drinkKey: 'wine'});
    expect(f(makeEvent({drinkKey: 'wine'}))).toBe(true);
    expect(f(makeEvent({drinkKey: 'beer'}))).toBe(false);
  });

  it('isoWeekDrinkType matches when both fields agree', () => {
    const f = bucketToFilter({
      kind: 'isoWeekDrinkType',
      isoWeek: '2025-W24',
      drinkKey: 'wine',
    });
    expect(f(makeEvent({localIsoWeek: '2025-W24', drinkKey: 'wine'}))).toBe(
      true,
    );
    expect(f(makeEvent({localIsoWeek: '2025-W24', drinkKey: 'beer'}))).toBe(
      false,
    );
    expect(f(makeEvent({localIsoWeek: '2025-W23', drinkKey: 'wine'}))).toBe(
      false,
    );
  });

  it('session-level bins pass every event at the event-filter layer', () => {
    const drink = bucketToFilter({
      kind: 'sessionDrinkCountBin',
      minDrinks: 1,
      maxDrinks: 2,
    });
    const duration = bucketToFilter({
      kind: 'sessionDurationBin',
      minMinutes: 0,
      maxMinutes: 30,
    });
    expect(drink(makeEvent({}))).toBe(true);
    expect(duration(makeEvent({}))).toBe(true);
  });
});

describe('bucketToSessionFilter', () => {
  it('event-level kinds pass every session', () => {
    const f = bucketToSessionFilter({kind: 'day', date: '2025-06-12'});
    expect(f({drinkCount: 999, durationMin: 999})).toBe(true);
    expect(f({drinkCount: 0, durationMin: undefined})).toBe(true);
  });

  it('sessionDrinkCountBin honours half-open [min, max)', () => {
    const f = bucketToSessionFilter({
      kind: 'sessionDrinkCountBin',
      minDrinks: 2,
      maxDrinks: 4,
    });
    expect(f({drinkCount: 1, durationMin: undefined})).toBe(false);
    expect(f({drinkCount: 2, durationMin: undefined})).toBe(true);
    expect(f({drinkCount: 3, durationMin: undefined})).toBe(true);
    expect(f({drinkCount: 4, durationMin: undefined})).toBe(false);
  });

  it('sessionDrinkCountBin with no max is open-ended (5+)', () => {
    const f = bucketToSessionFilter({
      kind: 'sessionDrinkCountBin',
      minDrinks: 5,
    });
    expect(f({drinkCount: 4, durationMin: undefined})).toBe(false);
    expect(f({drinkCount: 5, durationMin: undefined})).toBe(true);
    expect(f({drinkCount: 99, durationMin: undefined})).toBe(true);
  });

  it('sessionDurationBin excludes sessions with unknown duration', () => {
    const f = bucketToSessionFilter({
      kind: 'sessionDurationBin',
      minMinutes: 0,
      maxMinutes: 30,
    });
    expect(f({drinkCount: 1, durationMin: undefined})).toBe(false);
    expect(f({drinkCount: 1, durationMin: NaN})).toBe(false);
    expect(f({drinkCount: 1, durationMin: 0})).toBe(true);
    expect(f({drinkCount: 1, durationMin: 29.9})).toBe(true);
    expect(f({drinkCount: 1, durationMin: 30})).toBe(false);
  });

  it('sessionDurationBin with no max is open-ended (4h+)', () => {
    const f = bucketToSessionFilter({
      kind: 'sessionDurationBin',
      minMinutes: 240,
    });
    expect(f({drinkCount: 1, durationMin: 239.9})).toBe(false);
    expect(f({drinkCount: 1, durationMin: 240})).toBe(true);
    expect(f({drinkCount: 1, durationMin: 600})).toBe(true);
  });
});
