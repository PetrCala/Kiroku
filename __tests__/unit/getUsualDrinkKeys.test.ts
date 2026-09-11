import getUsualDrinkKeys, {
  FALLBACK_USUAL_DRINKS,
  USUAL_DRINKS_SESSION_WINDOW,
} from '@libs/getUsualDrinkKeys';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkingSessionList} from '@src/types/onyx';

const {KEYS} = CONST.DRINKS;

function session(
  startTime: number,
  drinks: Record<string, number | {count: number}>,
): DrinkingSession {
  return {
    start_time: startTime,
    drinks: {[startTime]: drinks},
  };
}

function list(...sessions: DrinkingSession[]): DrinkingSessionList {
  return Object.fromEntries(sessions.map((s, index) => [`s${index}`, s]));
}

describe('getUsualDrinkKeys', () => {
  test('no history falls back to the fixed picks', () => {
    expect(getUsualDrinkKeys(undefined)).toEqual(FALLBACK_USUAL_DRINKS);
    expect(getUsualDrinkKeys({})).toEqual(FALLBACK_USUAL_DRINKS);
  });

  test('ranks by total count across sessions', () => {
    const sessions = list(
      session(1, {[KEYS.COCKTAIL]: 1, [KEYS.WEAK_SHOT]: 4}),
      session(2, {[KEYS.COCKTAIL]: 2, [KEYS.SMALL_BEER]: 2}),
    );
    expect(getUsualDrinkKeys(sessions)).toEqual([
      KEYS.WEAK_SHOT,
      KEYS.COCKTAIL,
      KEYS.SMALL_BEER,
    ]);
  });

  test('counts the object entry form too', () => {
    const sessions = list(
      session(1, {[KEYS.WINE]: {count: 5}, [KEYS.BEER]: 1, [KEYS.OTHER]: 2}),
    );
    expect(getUsualDrinkKeys(sessions)).toEqual([
      KEYS.WINE,
      KEYS.OTHER,
      KEYS.BEER,
    ]);
  });

  test('tops up a thin history from the fallback without duplicates', () => {
    const sessions = list(session(1, {[KEYS.WINE]: 3}));
    expect(getUsualDrinkKeys(sessions)).toEqual([
      KEYS.WINE,
      KEYS.BEER,
      KEYS.STRONG_SHOT,
    ]);
  });

  test('ties keep the app drink order', () => {
    const sessions = list(session(1, {[KEYS.OTHER]: 2, [KEYS.BEER]: 2}));
    expect(getUsualDrinkKeys(sessions, 2)).toEqual([KEYS.BEER, KEYS.OTHER]);
  });

  test('only the most recent sessions count', () => {
    const recent = Array.from({length: USUAL_DRINKS_SESSION_WINDOW}, (_, i) =>
      session(1000 + i, {[KEYS.WINE]: 1}),
    );
    // Older than every recent session, so it falls outside the window.
    const old = session(1, {[KEYS.COCKTAIL]: 100});
    expect(getUsualDrinkKeys(list(old, ...recent), 1)).toEqual([KEYS.WINE]);
  });

  test('ignores unknown keys and zero counts', () => {
    const sessions = list(session(1, {mystery: 9, [KEYS.COCKTAIL]: 0}));
    expect(getUsualDrinkKeys(sessions)).toEqual(FALLBACK_USUAL_DRINKS);
  });
});
