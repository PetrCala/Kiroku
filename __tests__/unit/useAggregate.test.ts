import {renderHook} from '@testing-library/react-native';
import useAggregate from '@hooks/useStatistics/useAggregate';
import {
  aggregate,
  byDay,
  byDrinkKey,
  countEvents,
  sumUnits,
  weekendsOnly,
} from '@libs/Statistics';
import type {DrinkEvent} from '@libs/Statistics';

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

const EVENTS: DrinkEvent[] = [
  makeEvent({
    ts: Date.UTC(2025, 5, 12, 15),
    localDay: '2025-06-12',
    isWeekend: false,
    drinkKey: 'beer',
    units: 3,
  }),
  makeEvent({
    ts: Date.UTC(2025, 5, 13, 15),
    localDay: '2025-06-13',
    isWeekend: false,
    drinkKey: 'wine',
    units: 2,
  }),
  makeEvent({
    ts: Date.UTC(2025, 5, 14, 20),
    localDay: '2025-06-14',
    isWeekend: true,
    drinkKey: 'cocktail',
    units: 4,
  }),
];

describe('useAggregate', () => {
  test('delegates to aggregate() — by-day sum of units', () => {
    const {result} = renderHook(() => useAggregate(EVENTS, byDay, sumUnits));

    const expected = aggregate(EVENTS, byDay, sumUnits);

    expect(Array.from(result.current.entries())).toEqual(
      Array.from(expected.entries()),
    );
  });

  test('filter passthrough — weekendsOnly restricts to weekend buckets', () => {
    const {result} = renderHook(() =>
      useAggregate(EVENTS, byDay, sumUnits, weekendsOnly),
    );

    expect(Array.from(result.current.keys())).toEqual(['2025-06-14']);
    expect(result.current.get('2025-06-14')).toBe(4);
  });

  test('different bucketer produces different shape', () => {
    const {result} = renderHook(() =>
      useAggregate(EVENTS, byDrinkKey, countEvents),
    );

    expect(result.current.get('beer')).toBe(1);
    expect(result.current.get('wine')).toBe(1);
    expect(result.current.get('cocktail')).toBe(1);
  });

  test('empty events yields empty map', () => {
    const {result} = renderHook(() => useAggregate([], byDay, sumUnits));

    expect(result.current.size).toBe(0);
  });

  test('content is identical when re-rendered with the same inputs', () => {
    const {result, rerender} = renderHook(() =>
      useAggregate(EVENTS, byDay, sumUnits),
    );
    const firstEntries = Array.from(result.current.entries());

    rerender(undefined);

    expect(Array.from(result.current.entries())).toEqual(firstEntries);
  });
});
