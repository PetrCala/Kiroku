import {computeDrinkShares} from '@libs/Statistics/drinkKeyMeta';
import type {DrinkKey} from '@src/types/onyx/Drinks';

function mapOf(entries: Array<[DrinkKey, number]>): Map<DrinkKey, number> {
  return new Map(entries);
}

function setOf(keys: DrinkKey[]): Set<DrinkKey> {
  return new Set(keys);
}

describe('computeDrinkShares', () => {
  it('returns no entries for an empty map', () => {
    expect(computeDrinkShares(new Map(), new Set())).toEqual({
      entries: [],
      total: 0,
    });
  });

  it('returns no entries when every key holds zero units', () => {
    expect(
      computeDrinkShares(
        mapOf([
          ['beer', 0],
          ['wine', 0],
        ]),
        new Set(),
      ),
    ).toEqual({entries: [], total: 0});
  });

  it('orders entries by canonical DRINK_KEY_ORDER, not insertion order', () => {
    // Insert wine → beer → small_beer; expect small_beer, beer, wine out.
    const {entries, total} = computeDrinkShares(
      mapOf([
        ['wine', 3],
        ['beer', 6],
        ['small_beer', 1],
      ]),
      new Set(),
    );
    expect(total).toBe(10);
    expect(entries.map(e => e.key)).toEqual(['small_beer', 'beer', 'wine']);
    expect(entries.map(e => e.share)).toEqual([0.1, 0.6, 0.3]);
  });

  it('skips zero-unit keys without dropping the rest', () => {
    const {entries, total} = computeDrinkShares(
      mapOf([
        ['beer', 6],
        ['wine', 0],
        ['cocktail', 4],
      ]),
      new Set(),
    );
    expect(total).toBe(10);
    expect(entries.map(e => e.key)).toEqual(['beer', 'cocktail']);
  });

  it('an empty filter means all keys', () => {
    const {entries} = computeDrinkShares(
      mapOf([
        ['beer', 2],
        ['wine', 2],
      ]),
      new Set(),
    );
    expect(entries.map(e => e.key)).toEqual(['beer', 'wine']);
  });

  it('restricts to the active filter and re-bases shares on the subset', () => {
    const {entries, total} = computeDrinkShares(
      mapOf([
        ['beer', 6],
        ['wine', 4],
      ]),
      setOf(['wine']),
    );
    expect(total).toBe(4);
    expect(entries).toEqual([{key: 'wine', units: 4, share: 1}]);
  });
});
