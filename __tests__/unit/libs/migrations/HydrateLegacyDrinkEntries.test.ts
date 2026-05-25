/**
 * @jest-environment node
 */

import {
  convertDrinksList,
  convertSession,
} from '@libs/migrations/HydrateLegacyDrinkEntries';
import type {DrinkingSession, DrinksList} from '@src/types/onyx';
import {getDrinkCount} from '@libs/DrinkEntryUtils';

/* eslint-disable @typescript-eslint/naming-convention */

// The migration is two layers: pure conversion + Onyx writes. These tests
// pin down the conversion layer end-to-end. The Onyx layer is a straight
// `merge`/`set` over the converted result — exercising it here would
// require booting Onyx inside Jest and is well-covered by the existing
// integration paths in the app.

const makeSession = (
  id: string,
  drinks: DrinksList | undefined,
): DrinkingSession => ({
  id,
  start_time: 1_700_000_000_000,
  drinks,
});

describe('convertDrinksList', () => {
  it('returns undefined when input is undefined', () => {
    expect(convertDrinksList(undefined)).toBeUndefined();
  });

  it('hydrates legacy numeric entries to {count: N}', () => {
    const input: DrinksList = {
      1_700_000_000_000: {beer: 2, wine: 1},
    };
    const result = convertDrinksList(input);
    expect(result?.changed).toBe(true);
    expect(result?.drinks).toEqual({
      1_700_000_000_000: {beer: {count: 2}, wine: {count: 1}},
    });
  });

  it('is a no-op when every entry is already object-shaped', () => {
    const input: DrinksList = {
      1_700_000_000_000: {
        beer: {count: 2, volume_ml: 600},
        wine: {count: 1, abv: 0.13},
      },
    };
    const result = convertDrinksList(input);
    expect(result?.changed).toBe(false);
    expect(result?.drinks).toEqual(input);
  });

  it('preserves overrides on object entries when sibling entries hydrate', () => {
    const input: DrinksList = {
      1_700_000_000_000: {
        beer: 3,
        wine: {count: 1, volume_ml: 200},
      },
    };
    const result = convertDrinksList(input);
    expect(result?.changed).toBe(true);
    expect(result?.drinks[1_700_000_000_000]).toEqual({
      beer: {count: 3},
      wine: {count: 1, volume_ml: 200},
    });
  });

  it('is idempotent — running on its own output is a no-op', () => {
    const input: DrinksList = {
      1_700_000_000_000: {beer: 2, wine: 1, cocktail: 3},
    };
    const first = convertDrinksList(input);
    expect(first?.changed).toBe(true);
    if (!first) {
      return;
    }
    const second = convertDrinksList(first.drinks);
    expect(second?.changed).toBe(false);
    expect(second?.drinks).toEqual(first.drinks);
  });

  it('keeps total counts identical pre- and post-conversion', () => {
    const input: DrinksList = {
      1_700_000_000_000: {beer: 2, wine: 1},
      1_700_000_010_000: {
        beer: {count: 4, volume_ml: 600},
        cocktail: 1,
      },
    };
    const sumViaCounts = (drinks: DrinksList) =>
      Object.values(drinks).reduce<number>(
        (sum, day) =>
          sum +
          Object.values(day).reduce<number>(
            (s, entry) => s + getDrinkCount(entry),
            0,
          ),
        0,
      );
    const result = convertDrinksList(input);
    expect(result).toBeDefined();
    if (!result) {
      return;
    }
    expect(sumViaCounts(result.drinks)).toBe(sumViaCounts(input));
  });
});

describe('convertSession', () => {
  it('returns undefined for a session with no drinks', () => {
    expect(convertSession({id: 's', start_time: 0})).toBeUndefined();
  });

  it('returns undefined when nothing changed', () => {
    const session: DrinkingSession = makeSession('s', {
      1_700_000_000_000: {beer: {count: 2}},
    });
    expect(convertSession(session)).toBeUndefined();
  });

  it('returns a fresh session object when any entry hydrated', () => {
    const session = makeSession('s', {1_700_000_000_000: {beer: 2}});
    const result = convertSession(session);
    expect(result?.changed).toBe(true);
    expect(result?.session).not.toBe(session);
    expect(result?.session.drinks).toEqual({
      1_700_000_000_000: {beer: {count: 2}},
    });
  });

  it('preserves all other session fields verbatim', () => {
    const session: DrinkingSession = {
      id: 's',
      start_time: 1,
      end_time: 2,
      note: 'hello',
      blackout: true,
      ongoing: false,
      drinks: {1_700_000_000_000: {beer: 1}},
    };
    const result = convertSession(session);
    expect(result?.session).toEqual({
      ...session,
      drinks: {1_700_000_000_000: {beer: {count: 1}}},
    });
  });
});
