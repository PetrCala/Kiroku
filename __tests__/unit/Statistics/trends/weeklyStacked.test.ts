/**
 * @jest-environment node
 */

import buildWeeklyStackedSeries from '@libs/Statistics/trends/weeklyStacked';
import type {DrinkEvent} from '@libs/Statistics';
import type {DrinkKey} from '@src/types/onyx/Drinks';

const ALL_KEYS: readonly DrinkKey[] = [
  'small_beer',
  'beer',
  'wine',
  'cocktail',
  'strong_shot',
  'weak_shot',
  'other',
];

function event(overrides: Partial<DrinkEvent>): DrinkEvent {
  return {
    userId: 'u1',
    sessionId: 's1',
    ts: new Date('2026-04-08T12:00:00.000Z').getTime(),
    localDay: '2026-04-08',
    localIsoWeek: '2026-W15',
    localMonth: '2026-04',
    localHour: 12,
    localDow: 2,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units: 1,
    blackoutSession: false,
    ...overrides,
  };
}

describe('buildWeeklyStackedSeries', () => {
  test('empty filter tracks all keys, zero-filled per week', () => {
    const {weeks, trackedKeys} = buildWeeklyStackedSeries(
      [],
      new Date(2026, 3, 6, 12), // Mon Apr 6 2026, local noon → ISO W15
      new Date(2026, 3, 12, 12), // Sun Apr 12 2026, local noon → ISO W15
      new Set<DrinkKey>(),
      ALL_KEYS,
    );
    expect(trackedKeys).toEqual(ALL_KEYS);
    expect(weeks).toHaveLength(1);
    for (const key of ALL_KEYS) {
      expect(weeks[0].byKey[key]).toBe(0);
    }
  });

  test('non-empty filter narrows tracked keys', () => {
    const {trackedKeys} = buildWeeklyStackedSeries(
      [],
      new Date(2026, 3, 6, 12),
      new Date(2026, 3, 12, 12),
      new Set<DrinkKey>(['beer', 'wine']),
      ALL_KEYS,
    );
    expect(trackedKeys).toEqual(['beer', 'wine']);
  });

  test('attributes units to the correct week + key', () => {
    const events = [
      event({localIsoWeek: '2026-W15', drinkKey: 'beer', units: 4}),
      event({localIsoWeek: '2026-W15', drinkKey: 'wine', units: 2}),
      event({
        localIsoWeek: '2026-W16',
        ts: new Date('2026-04-15T12:00:00.000Z').getTime(),
        localDay: '2026-04-15',
        drinkKey: 'beer',
        units: 1,
      }),
    ];
    const {weeks} = buildWeeklyStackedSeries(
      events,
      new Date(2026, 3, 6, 12),
      new Date(2026, 3, 19, 12), // Sun Apr 19 → ISO W16
      new Set<DrinkKey>(),
      ALL_KEYS,
    );
    expect(weeks).toHaveLength(2);
    expect(weeks[0].isoWeek).toBe('2026-W15');
    expect(weeks[0].byKey.beer).toBe(4);
    expect(weeks[0].byKey.wine).toBe(2);
    expect(weeks[1].byKey.beer).toBe(1);
    expect(weeks[1].byKey.wine).toBe(0);
  });

  test('filter excludes drink keys not in the active filter', () => {
    const events = [
      event({localIsoWeek: '2026-W15', drinkKey: 'beer', units: 4}),
      event({localIsoWeek: '2026-W15', drinkKey: 'wine', units: 2}),
    ];
    const {weeks, trackedKeys} = buildWeeklyStackedSeries(
      events,
      new Date(2026, 3, 6, 12),
      new Date(2026, 3, 12, 12),
      new Set<DrinkKey>(['beer']),
      ALL_KEYS,
    );
    expect(trackedKeys).toEqual(['beer']);
    expect(weeks[0].byKey.beer).toBe(4);
    expect((weeks[0].byKey as Record<string, number>).wine).toBeUndefined();
  });
});
