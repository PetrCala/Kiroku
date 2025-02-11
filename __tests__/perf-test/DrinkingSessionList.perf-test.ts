import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {measureFunction} from 'reassure';
import type {DrinkingSession} from '@src/types/onyx';
import {randDrinkingSessionList} from '../utils/collections/drinkingSessions';

beforeAll(() =>
  Onyx.init({
    keys: ONYXKEYS,
    safeEvictionKeys: [ONYXKEYS.COLLECTION.DRINKING_SESSION],
  }),
);

// Clear out Onyx after each test so that each test starts with a clean state
afterEach(() => {
  Onyx.clear();
});

describe('DrinkingSessionList', () => {
  test('[DrinkingSessionList] valid drinking session collection generation', async () => {
    await measureFunction(
      () =>
        randDrinkingSessionList({length: 1000}) as Record<
          `${typeof ONYXKEYS.COLLECTION.DRINKING_SESSION}`,
          DrinkingSession
        >,
    );
  });
});
