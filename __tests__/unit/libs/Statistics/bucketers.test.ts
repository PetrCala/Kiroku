import {
  byBlackout,
  byDay,
  byDow,
  byDrinkKey,
  byHour,
  byIsoWeek,
  byMonth,
  byQuarter,
  byUserId,
  byYear,
  composeBuckets,
  COMPOSITE_KEY_SEP,
} from '@libs/Statistics/bucketers';
import type {DrinkEvent} from '@libs/Statistics/types';

function event(overrides: Partial<DrinkEvent>): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's1',
    ts: 0,
    localDay: '2024-05-15',
    localIsoWeek: '2024-W20',
    localMonth: '2024-05',
    localHour: 14,
    localDow: 2,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 1,
    blackoutSession: false,
    ...overrides,
  };
}

describe('bucketers', () => {
  it('byHour returns localHour', () => {
    expect(byHour(event({localHour: 9}))).toBe(9);
  });

  it('byDow returns localDow', () => {
    expect(byDow(event({localDow: 5}))).toBe(5);
  });

  it('byDay returns localDay', () => {
    expect(byDay(event({localDay: '2024-05-20'}))).toBe('2024-05-20');
  });

  it('byIsoWeek returns localIsoWeek', () => {
    expect(byIsoWeek(event({localIsoWeek: '2024-W22'}))).toBe('2024-W22');
  });

  it('byMonth returns localMonth', () => {
    expect(byMonth(event({localMonth: '2024-07'}))).toBe('2024-07');
  });

  it('byQuarter derives yyyy-Qn from localMonth', () => {
    expect(byQuarter(event({localMonth: '2024-01'}))).toBe('2024-Q1');
    expect(byQuarter(event({localMonth: '2024-03'}))).toBe('2024-Q1');
    expect(byQuarter(event({localMonth: '2024-04'}))).toBe('2024-Q2');
    expect(byQuarter(event({localMonth: '2024-09'}))).toBe('2024-Q3');
    expect(byQuarter(event({localMonth: '2024-12'}))).toBe('2024-Q4');
  });

  it('byYear takes the first 4 chars of localMonth', () => {
    expect(byYear(event({localMonth: '2023-11'}))).toBe('2023');
  });

  it('byDrinkKey returns drinkKey', () => {
    expect(byDrinkKey(event({drinkKey: 'wine'}))).toBe('wine');
  });

  it('byBlackout returns blackoutSession', () => {
    expect(byBlackout(event({blackoutSession: true}))).toBe(true);
    expect(byBlackout(event({blackoutSession: false}))).toBe(false);
  });

  it('byUserId returns userId', () => {
    expect(byUserId(event({userId: 'alice'}))).toBe('alice');
  });

  it('composeBuckets joins keys with the unit-separator', () => {
    const composed = composeBuckets(byDay, byDrinkKey);
    expect(composed(event({localDay: '2024-05-15', drinkKey: 'beer'}))).toBe(
      `2024-05-15${COMPOSITE_KEY_SEP}beer`,
    );
  });

  it('composeBuckets handles non-string bucketer outputs', () => {
    const composed = composeBuckets(byHour, byBlackout);
    expect(composed(event({localHour: 22, blackoutSession: true}))).toBe(
      `22${COMPOSITE_KEY_SEP}true`,
    );
  });
});
