import {
  POPULATION_PRIOR,
  buildDrinkProfile,
  getLatestDrinkKey,
  getTimeBucket,
  rankQuickAdd,
  SESSION_WINDOW,
} from '@libs/DrinkRanking';
import type {DrinkProfile} from '@libs/DrinkRanking/types';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkingSessionList} from '@src/types/onyx';
import type {DrinkKey, DrinksList} from '@src/types/onyx/Drinks';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const {KEYS} = CONST.DRINKS;
const UTC = 'UTC' as SelectedTimezone;
const PRAGUE = 'Europe/Prague' as SelectedTimezone;
const NOW = Date.UTC(2026, 8, 1);

/** The prior's order: what a user with no history sees. */
const PRIOR_ORDER = [
  KEYS.BEER,
  KEYS.WINE,
  KEYS.SMALL_BEER,
  KEYS.STRONG_SHOT,
  KEYS.COCKTAIL,
  KEYS.WEAK_SHOT,
  KEYS.OTHER,
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** An epoch ms `hour` o'clock UTC on the given January 2026 day. */
function at(hour: number, day = 5): number {
  return Date.UTC(2026, 0, day, hour);
}

/** A finished session with all its drinks logged at its start. */
function session(
  startTime: number,
  drinks: Record<string, number | {count: number}>,
  extra: Partial<DrinkingSession> = {},
): DrinkingSession {
  return {
    start_time: startTime,
    timezone: UTC,
    drinks: {[startTime]: drinks},
    ...extra,
  };
}

/** A finished session with drinks at several timestamps. */
function sessionWith(
  startTime: number,
  drinks: DrinksList,
  extra: Partial<DrinkingSession> = {},
): DrinkingSession {
  return {start_time: startTime, timezone: UTC, drinks, ...extra};
}

function list(...sessions: DrinkingSession[]): DrinkingSessionList {
  return Object.fromEntries(sessions.map((s, index) => [`s${index}`, s]));
}

function build(...sessions: DrinkingSession[]): DrinkProfile {
  return buildDrinkProfile(list(...sessions), {now: NOW});
}

/** `count` sessions of one drink, one per day, the newest starting on `newestDay`. */
function streak(
  key: string,
  count: number,
  newestDay: number,
): DrinkingSession[] {
  return Array.from({length: count}, (_, index) =>
    session(at(20, newestDay) - index * DAY, {[key]: 2}),
  );
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

describe('getTimeBucket', () => {
  test('splits the day at 5, 17, 21 and 1', () => {
    expect(getTimeBucket(5)).toBe('day');
    expect(getTimeBucket(16)).toBe('day');
    expect(getTimeBucket(17)).toBe('evening');
    expect(getTimeBucket(20)).toBe('evening');
    expect(getTimeBucket(21)).toBe('night');
    expect(getTimeBucket(23)).toBe('night');
    expect(getTimeBucket(0)).toBe('night');
    expect(getTimeBucket(1)).toBe('late');
    expect(getTimeBucket(4)).toBe('late');
  });
});

describe('buildDrinkProfile', () => {
  test('no history is the population prior everywhere', () => {
    const profile = buildDrinkProfile(undefined, {now: NOW});
    expect(profile).toMatchObject({
      schema_version: 1,
      computed_at: NOW,
      session_count: 0,
      overall: POPULATION_PRIOR,
    });
    expect(profile.by_bucket.evening).toEqual(POPULATION_PRIOR);
    expect(rankQuickAdd(profile)).toEqual(PRIOR_ORDER);
    expect(build()).toEqual(profile);
  });

  test('every distribution sums to one', () => {
    const profile = build(
      session(at(19), {[KEYS.WINE]: 2, [KEYS.BEER]: 1}),
      session(at(19, 6), {[KEYS.STRONG_SHOT]: 3}),
    );
    expect(sum(profile.overall)).toBeCloseTo(1, 3);
    for (const bucket of Object.values(profile.by_bucket)) {
      expect(sum(bucket)).toBeCloseTo(1, 3);
    }
  });

  test('one session puts its drink first, then the prior order', () => {
    const profile = build(session(at(19), {[KEYS.WINE]: 3}));
    expect(profile.session_count).toBe(1);
    expect(rankQuickAdd(profile)).toEqual([
      KEYS.WINE,
      ...PRIOR_ORDER.filter(key => key !== KEYS.WINE),
    ]);
  });

  test('a session votes by the share of each drink in it', () => {
    const profile = build(
      session(at(19), {[KEYS.BEER]: 5, [KEYS.STRONG_SHOT]: {count: 1}}),
    );
    expect(rankQuickAdd(profile)).toEqual([
      KEYS.BEER,
      KEYS.STRONG_SHOT,
      KEYS.WINE,
      KEYS.SMALL_BEER,
      KEYS.COCKTAIL,
      KEYS.WEAK_SHOT,
      KEYS.OTHER,
    ]);
  });

  test('recent sessions outweigh older ones', () => {
    const recentWine = build(
      ...streak(KEYS.BEER, 10, 20),
      ...streak(KEYS.WINE, 6, 30),
    );
    expect(rankQuickAdd(recentWine).slice(0, 2)).toEqual([
      KEYS.WINE,
      KEYS.BEER,
    ]);

    const recentBeer = build(
      ...streak(KEYS.WINE, 6, 20),
      ...streak(KEYS.BEER, 10, 30),
    );
    expect(rankQuickAdd(recentBeer).slice(0, 2)).toEqual([
      KEYS.BEER,
      KEYS.WINE,
    ]);
  });

  test('ongoing and empty sessions cast no vote', () => {
    const beerOnly = build(session(at(19), {[KEYS.BEER]: 2}));
    const withNoise = build(
      session(at(19), {[KEYS.BEER]: 2}),
      session(at(19, 6), {[KEYS.COCKTAIL]: 4}, {ongoing: true}),
      session(at(19, 7), {}),
      {start_time: at(19, 8), timezone: UTC},
    );
    expect(withNoise).toEqual(beerOnly);
    expect(withNoise.session_count).toBe(1);
  });

  test('only the newest sessions count', () => {
    const window = streak(KEYS.BEER, SESSION_WINDOW, 40);
    const beyond = session(at(20, 40) - SESSION_WINDOW * DAY, {
      [KEYS.COCKTAIL]: 5,
    });
    expect(build(...window, beyond)).toEqual(build(...window));
  });

  test('each part of the day follows the drinks logged in it', () => {
    const profile = build(
      sessionWith(at(19), {
        [at(19)]: {[KEYS.WINE]: 1},
        [at(23) + 30 * 60 * 1000]: {[KEYS.STRONG_SHOT]: 2},
      }),
    );
    expect(rankQuickAdd(profile).at(0)).toBe(KEYS.STRONG_SHOT);
    expect(
      rankQuickAdd(profile, {start_time: at(19), timezone: UTC}).at(0),
    ).toBe(KEYS.WINE);
    expect(
      rankQuickAdd(profile, {start_time: at(23), timezone: UTC}).at(0),
    ).toBe(KEYS.STRONG_SHOT);
  });

  test('reads the local hour in the session timezone', () => {
    // 18:00 UTC is 19:00 in Prague (evening); 22:30 UTC is 23:30 (night).
    const profile = build(
      sessionWith(
        at(18),
        {
          [at(18)]: {[KEYS.WINE]: 1},
          [at(22) + 30 * 60 * 1000]: {[KEYS.STRONG_SHOT]: 2},
        },
        {timezone: PRAGUE},
      ),
    );
    expect(
      rankQuickAdd(profile, {start_time: at(18), timezone: PRAGUE}).at(0),
    ).toBe(KEYS.WINE);
    expect(
      rankQuickAdd(profile, {start_time: at(22), timezone: PRAGUE}).at(0),
    ).toBe(KEYS.STRONG_SHOT);
  });

  test('trusts stored time parts only when computed under the session timezone', () => {
    const parts = {d: '2026-01-05', h: 2, w: '2026-W02', dow: 1};
    const late = build(
      session(
        at(19),
        {[KEYS.WINE]: 1},
        {drinksTimeParts: {tz: UTC, byTs: {[at(19)]: parts}}},
      ),
    );
    const evening = build(
      session(
        at(19),
        {[KEYS.WINE]: 1},
        {drinksTimeParts: {tz: PRAGUE, byTs: {[at(19)]: parts}}},
      ),
    );
    expect(late.by_bucket.late.wine).toBeGreaterThan(
      late.by_bucket.evening.wine,
    );
    expect(evening.by_bucket.evening.wine).toBeGreaterThan(
      evening.by_bucket.late.wine,
    );
  });
});

describe('getLatestDrinkKey', () => {
  const withDrinks = (drinks: DrinksList) => ({start_time: at(19), drinks});

  test('is the drink in the newest timestamp that still holds one', () => {
    expect(getLatestDrinkKey(undefined)).toBeUndefined();
    expect(getLatestDrinkKey({start_time: at(19)})).toBeUndefined();
    expect(getLatestDrinkKey(withDrinks({}))).toBeUndefined();
    expect(
      getLatestDrinkKey(
        withDrinks({
          [at(19)]: {[KEYS.BEER]: 1},
          [at(20)]: {[KEYS.COCKTAIL]: 1},
          [at(21)]: {[KEYS.WINE]: 0},
        }),
      ),
    ).toBe(KEYS.COCKTAIL);
  });

  test('breaks a tie by count, then by the drink order', () => {
    expect(
      getLatestDrinkKey(
        withDrinks({[at(19)]: {[KEYS.WINE]: 1, [KEYS.STRONG_SHOT]: 2}}),
      ),
    ).toBe(KEYS.STRONG_SHOT);
    expect(
      getLatestDrinkKey(
        withDrinks({[at(19)]: {[KEYS.WINE]: 2, [KEYS.STRONG_SHOT]: 2}}),
      ),
    ).toBe(KEYS.STRONG_SHOT);
    expect(
      getLatestDrinkKey(
        withDrinks({[at(19)]: {[KEYS.WINE]: 3, [KEYS.STRONG_SHOT]: 2}}),
      ),
    ).toBe(KEYS.WINE);
  });

  test('reads a v2 session the same way', () => {
    const entry = (ts: number, key: DrinkKey, count: number) => ({
      ts,
      key,
      count,
      source: 'phone' as const,
      author_uid: 'u',
      target_uid: 'u',
      created_at: ts,
    });
    expect(
      getLatestDrinkKey({
        schema_version: 2,
        start_time: at(19),
        entries: {
          a: entry(at(19), KEYS.BEER, 1),
          b: entry(at(20), KEYS.COCKTAIL, 1),
          c: {...entry(at(21), KEYS.WINE, 1), deleted: true},
        },
      }),
    ).toBe(KEYS.COCKTAIL);
  });
});

describe('rankQuickAdd', () => {
  const prior = buildDrinkProfile(undefined, {now: NOW});

  test('lists every drink type once', () => {
    const ranked = rankQuickAdd(prior, {start_time: at(19), timezone: UTC});
    expect([...ranked].sort()).toEqual(Object.values(KEYS).sort());
  });

  test('pins the drink logged most recently, and nothing else moves', () => {
    const live = sessionWith(
      at(19),
      {[at(19)]: {[KEYS.BEER]: 1}, [at(20)]: {[KEYS.COCKTAIL]: 1}},
      {ongoing: true},
    );
    expect(rankQuickAdd(prior, live)).toEqual([
      KEYS.COCKTAIL,
      ...PRIOR_ORDER.filter(key => key !== KEYS.COCKTAIL),
    ]);

    // Removing the cocktail again makes the beer the latest drink.
    const undone = sessionWith(
      at(19),
      {[at(19)]: {[KEYS.BEER]: 1}, [at(20)]: {[KEYS.COCKTAIL]: 0}},
      {ongoing: true},
    );
    expect(rankQuickAdd(prior, undone)).toEqual(PRIOR_ORDER);
  });

  test('keeps the order of the part of the day the session started in', () => {
    const profile = build(
      sessionWith(at(19), {
        [at(19)]: {[KEYS.WINE]: 1},
        [at(23)]: {[KEYS.STRONG_SHOT]: 2},
      }),
    );
    // Started in the evening, now past 23:00 with a shot just logged: the shot
    // is pinned, and the rest still follow the evening order (wine first).
    const live = sessionWith(
      at(19, 6),
      {[at(23, 6)]: {[KEYS.STRONG_SHOT]: 1}},
      {ongoing: true},
    );
    expect(rankQuickAdd(profile, live).slice(0, 2)).toEqual([
      KEYS.STRONG_SHOT,
      KEYS.WINE,
    ]);
  });
});
