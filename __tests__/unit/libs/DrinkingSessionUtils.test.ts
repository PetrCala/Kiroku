/**
 * @jest-environment node
 */

import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {
  DrinkingSession,
  DrinkingSessionList,
  DrinksList,
  DrinksToUnits,
} from '@src/types/onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {getZeroDrinksList} from '@libs/DataHandling';
import {randDrinkingSession} from '../../utils/collections/drinkingSessions';

const ALL_DRINKS_TO_UNITS: DrinksToUnits = {
  small_beer: 1,
  beer: 1,
  cocktail: 1,
  other: 1,
  strong_shot: 1,
  weak_shot: 1,
  wine: 1,
};

/* eslint-disable @typescript-eslint/naming-convention */

describe('determineSessionMostCommonDrink', () => {
  let session: DrinkingSession;

  beforeEach(() => {
    session = randDrinkingSession(new Date().getTime());
  });

  it('identifies the most common drink with a single type', () => {
    session.drinks = {
      1588412400000: {beer: 3},
    };
    expect(DSUtils.determineSessionMostCommonDrink(session)).toBe(
      CONST.DRINKS.KEYS.BEER,
    );
  });

  it("returns 'other' in case there are multiple units with the highest count", () => {
    session.drinks = {
      1588412400000: {beer: 2, wine: 1},
      1588498800000: {beer: 1, cocktail: 3},
    };
    expect(DSUtils.determineSessionMostCommonDrink(session)).toBe(
      CONST.DRINKS.KEYS.OTHER,
    );
  });

  it('returns null in case all units are set to 0', () => {
    session.drinks = getZeroDrinksList();
    expect(DSUtils.determineSessionMostCommonDrink(session)).toBeNull();
  });

  it('returns null for a session with no drinks', () => {
    session.drinks = {};
    expect(DSUtils.determineSessionMostCommonDrink(session)).toBeNull();
  });
});

describe('calculateTotalUnits', () => {
  it('should return 0 if all drinks are 0', () => {
    const zeroDrinks: DrinksList = {
      1632423423: {
        beer: 0,
        cocktail: 0,
        other: 0,
      },
      1632434223: {
        beer: 0,
      },
    };
    const zeroDrinksToUnits: DrinksToUnits = {
      small_beer: 0,
      beer: 0,
      cocktail: 0,
      other: 0,
      strong_shot: 0,
      weak_shot: 0,
      wine: 0,
    };
    const result = DSUtils.calculateTotalUnits(zeroDrinks, zeroDrinksToUnits);
    expect(result).toBe(0);
  });

  it('should correctly handle missing keys in DrinksList', () => {
    const partialDrinks: DrinksList = {
      1632423423: {
        beer: 2,
        cocktail: 1,
      },
      1632434223: {
        other: 3,
      },
    };
    const sampleDrinksToUnits: DrinksToUnits = {
      small_beer: 3,
      beer: 5,
      cocktail: 10,
      other: 1,
      strong_shot: 15,
      weak_shot: 5,
      wine: 7,
    };
    const result = DSUtils.calculateTotalUnits(
      partialDrinks,
      sampleDrinksToUnits,
    );
    expect(result).toBe(2 * 5 + 1 * 10 + 3 * 1);
  });

  it('should use the count field when entries are object-shaped', () => {
    const mixedDrinks: DrinksList = {
      1632423423: {
        beer: 2,
        cocktail: {count: 1, volume_ml: 250, abv: 0.1},
      },
      1632434223: {
        other: {count: 3},
      },
    };
    const sampleDrinksToUnits: DrinksToUnits = {
      small_beer: 3,
      beer: 5,
      cocktail: 10,
      other: 1,
      strong_shot: 15,
      weak_shot: 5,
      wine: 7,
    };
    const result = DSUtils.calculateTotalUnits(
      mixedDrinks,
      sampleDrinksToUnits,
    );
    expect(result).toBe(2 * 5 + 1 * 10 + 3 * 1);
  });
});

describe('getOngoingSessionId', () => {
  const base = randDrinkingSession(new Date().getTime());

  it('returns null for empty / nullish input', () => {
    expect(DSUtils.getOngoingSessionId(undefined)).toBeNull();
    expect(DSUtils.getOngoingSessionId(null)).toBeNull();
    expect(DSUtils.getOngoingSessionId({})).toBeNull();
  });

  it('returns the id of the session whose ongoing flag is true', () => {
    const list: DrinkingSessionList = {
      a: {...base, ongoing: false},
      b: {...base, ongoing: true},
    };
    expect(DSUtils.getOngoingSessionId(list)).toBe('b');
  });

  it('drops a finalized session: ongoing:false yields no ongoing id', () => {
    const list: DrinkingSessionList = {
      a: {...base, ongoing: false},
    };
    expect(DSUtils.getOngoingSessionId(list)).toBeNull();
  });

  it('treats a missing ongoing flag as not ongoing', () => {
    const list: DrinkingSessionList = {
      a: {...base, ongoing: undefined},
    };
    expect(DSUtils.getOngoingSessionId(list)).toBeNull();
  });
});

describe('setLocalSessionCache / compose-on-latest', () => {
  const liveBase: DrinkingSession = {
    ...randDrinkingSession(new Date().getTime()),
    id: 'live-1',
    ongoing: true,
    drinks: {},
  };

  afterEach(() => {
    // Reset the module-level caches the setter mutates.
    DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, undefined);
    DSUtils.setLocalSessionCache(ONYXKEYS.EDIT_SESSION_DATA, undefined);
  });

  it('makes getDrinkingSessionData return the new value synchronously', () => {
    DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, liveBase);
    expect(DSUtils.getDrinkingSessionData('live-1')).toBe(liveBase);

    const updated = {...liveBase, note: 'changed'};
    DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, updated);
    expect(DSUtils.getDrinkingSessionData('live-1')).toBe(updated);
  });

  it('clearing the cache makes getDrinkingSessionData return undefined', () => {
    DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, liveBase);
    DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, undefined);
    expect(DSUtils.getDrinkingSessionData('live-1')).toBeUndefined();
  });

  it('three adds then one remove, each composing on the cache, net +2 (dropped-tap repro)', () => {
    // Mirrors what updateDrinks does per tap: read the cache, modify, write back
    // synchronously — without driving any async Onyx.connect refresh in between.
    DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, liveBase);

    const sequence = [
      CONST.DRINKS.ACTIONS.ADD,
      CONST.DRINKS.ACTIONS.ADD,
      CONST.DRINKS.ACTIONS.ADD,
      CONST.DRINKS.ACTIONS.REMOVE,
    ];
    sequence.forEach(action => {
      const current = DSUtils.getDrinkingSessionData('live-1');
      expect(current).toBeDefined();
      if (!current) {
        return;
      }
      const drinks = DSUtils.modifySessionDrinks(
        current,
        CONST.DRINKS.KEYS.BEER,
        1,
        action,
        ALL_DRINKS_TO_UNITS,
      );
      DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, {
        ...current,
        drinks,
      });
    });

    const final = DSUtils.getDrinkingSessionData('live-1');
    expect(
      DSUtils.calculateTotalUnits(final?.drinks, ALL_DRINKS_TO_UNITS),
    ).toBe(2);
  });
});

// TODO
// describe('getSingleDayDrinkingSessions', () => {
//   it('should return sessions that only fall within the given date', () => {
//     const baseDate = new Date('2023-08-20');
//     const testSessions: DrinkingSessionList = {
//       [new Date().getTime()]: createMockSession(baseDate, 0), // Session from 'today'
//       [new Date().getTime() + 1]: createMockSession(baseDate, -1), // Session from 'yesterday'
//       [new Date().getTime() + 2]: createMockSession(baseDate, 1), // Session from 'tomorrow'
//     };

//     const result = DSUtils.getSingleDayDrinkingSessions(baseDate, testSessions);
//     expect(result).toHaveLength(1);
//   });

//   it('should return an empty array if no sessions fall within the given date', () => {
//     const baseDate = new Date('2023-08-22');
//     const testSessions: DrinkingSessionList = {
//       [new Date().getTime()]: createMockSession(baseDate, -2),
//       [new Date().getTime() + 1]: createMockSession(baseDate, -3),
//     };

//     const result = DSUtils.getSingleDayDrinkingSessions(baseDate, testSessions);
//     expect(result).toHaveLength(0);
//     expect(result).toEqual([]);
//   });
// });

// describe('getSingleMonthDrinkingSessions', () => {
//   it('should return sessions that only fall within the given month', () => {
//     const baseDate = new Date('2023-08-20');
//     const testSessions: DrinkingSessionArray = [
//       createMockSession(baseDate, 0), // Session from this month
//       createMockSession(baseDate, -30), // Session from last month
//       createMockSession(baseDate, 30), // Session from next month
//     ];

//     const result = DSUtils.getSingleMonthDrinkingSessions(
//       baseDate,
//       testSessions,
//     );
//     expect(result).toHaveLength(1);
//   });

//   it('should return sessions until today when untilToday flag is true', () => {
//     const baseDate = new Date('2023-08-20');
//     const futureSessionDate = new Date();
//     futureSessionDate.setDate(futureSessionDate.getDate() + 5); // A session 5 days into the future

//     const testSessions: DrinkingSessionArray = [
//       createMockSession(baseDate, 0), // Session from this month
//       {
//         ...createMockSession(baseDate, 0),
//         start_time: futureSessionDate.getTime(),
//       },
//     ];

//     const result = DSUtils.getSingleMonthDrinkingSessions(
//       baseDate,
//       testSessions,
//       true,
//     );
//     expect(result).toHaveLength(1);
//   });

//   it('should return an empty array if no sessions fall within the given month', () => {
//     const baseDate = new Date('2023-08-22');
//     const testSessions: DrinkingSessionArray = [
//       createMockSession(baseDate, -60),
//       createMockSession(baseDate, -90),
//     ];

//     const result = DSUtils.getSingleMonthDrinkingSessions(
//       baseDate,
//       testSessions,
//     );
//     expect(result).toHaveLength(0);
//     expect(result).toEqual([]);
//   });
// });
