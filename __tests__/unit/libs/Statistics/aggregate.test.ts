import aggregate from '@libs/Statistics/aggregate';
import {
  byDay,
  byDrinkKey,
  composeBuckets,
  COMPOSITE_KEY_SEP,
} from '@libs/Statistics/bucketers';
import {countEvents, sumUnits} from '@libs/Statistics/reducers';
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
    units: 1,
    blackoutSession: false,
    ...overrides,
  };
}

describe('aggregate', () => {
  it('returns an empty Map for empty input', () => {
    expect(aggregate([], byDay, sumUnits).size).toBe(0);
  });

  it('reduces a single bucket', () => {
    const result = aggregate(
      [event({units: 2}), event({units: 3})],
      byDay,
      sumUnits,
    );
    expect(result.get('2024-01-15')).toBe(5);
  });

  it('reduces multiple buckets independently', () => {
    const result = aggregate(
      [
        event({drinkKey: 'beer', units: 2}),
        event({drinkKey: 'beer', units: 1}),
        event({drinkKey: 'wine', units: 4}),
      ],
      byDrinkKey,
      sumUnits,
    );
    expect(result.get('beer')).toBe(3);
    expect(result.get('wine')).toBe(4);
  });

  it('applies filter before bucketing', () => {
    const result = aggregate(
      [
        event({drinkKey: 'beer', units: 2}),
        event({drinkKey: 'wine', units: 4}),
      ],
      byDrinkKey,
      sumUnits,
      e => e.drinkKey === 'beer',
    );
    expect(result.size).toBe(1);
    expect(result.get('beer')).toBe(2);
  });

  it('returns empty Map when filter rejects everything', () => {
    const result = aggregate([event({units: 2})], byDay, sumUnits, () => false);
    expect(result.size).toBe(0);
  });

  it('composes bucketers into a string cross-product key', () => {
    const result = aggregate(
      [
        event({localDay: '2024-01-15', drinkKey: 'beer'}),
        event({localDay: '2024-01-15', drinkKey: 'beer'}),
        event({localDay: '2024-01-15', drinkKey: 'wine'}),
        event({localDay: '2024-01-16', drinkKey: 'beer'}),
      ],
      composeBuckets(byDay, byDrinkKey),
      countEvents,
    );
    expect(result.get(`2024-01-15${COMPOSITE_KEY_SEP}beer`)).toBe(2);
    expect(result.get(`2024-01-15${COMPOSITE_KEY_SEP}wine`)).toBe(1);
    expect(result.get(`2024-01-16${COMPOSITE_KEY_SEP}beer`)).toBe(1);
  });
});
