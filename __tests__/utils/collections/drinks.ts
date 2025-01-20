import {rand, randNumber, randPastDate} from '@ngneat/falso';
import CONST from '@src/CONST';
import type {Drinks, DrinksList} from '@src/types/onyx';
import type {Timestamp} from '@src/types/onyx/OnyxCommon';
import {getRandomTimestamp} from './timestamp';
import createCollection from './createCollection';

/**
 * Generate an object of mock drinks.
 *
 * @example
 *
 * randDrinks() // {'beer': 2}
 */
function randDrinks(): Drinks {
  return {
    [rand(Object.values(CONST.DRINKS.KEYS))]: randNumber({min: 1, max: 3}),
  };
}

type RandDrinksListParams = {
  /** Earliest timestamp that the drinks can be logged under */
  from?: Timestamp;

  /** Latest timestamp that the drinks can be logged under */
  to?: Timestamp;

  /** How many drinks objects to generate */
  length?: number;
};

/**
 * Generate a collection of mock drinks
 *
 * @example
 *
 * randDrinksList({from: 1737379183, length: 20})
 */
function randDrinksList({
  from,
  to,
  length = 5,
}: RandDrinksListParams): DrinksList {
  if (length <= 0) {
    return {};
  }

  const timestampFrom = from ?? randPastDate().getTime();
  const timestampTo = to ?? new Date().getTime();

  return createCollection<Drinks>(
    () => getRandomTimestamp(timestampFrom, timestampTo),
    () => randDrinks(),
    length,
  );
}

export {randDrinks, randDrinksList};
