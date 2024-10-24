import DSUtils from '@libs/DrinkingSessionUtils';
import type {DrinkingSession} from '@src/types/onyx';
import {createMockSession} from '../../../src/database/MockDatabase';
import CONST from '@src/CONST';
import {getZeroDrinksList} from '@libs/DataHandling';

describe('determineSessionMostCommonDrink', () => {
  let session: DrinkingSession;

  beforeEach(() => {
    session = createMockSession(new Date());
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
