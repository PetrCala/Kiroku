/**
 * @jest-environment node
 */

import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {
  DrinkingSession,
  DrinkingSessionArray,
  DrinkingSessionList,
  DrinksList,
  DrinksToUnits,
} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
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

const UTC = 'UTC' as SelectedTimezone;
const TOKYO = 'Asia/Tokyo' as SelectedTimezone; // UTC+9
const LA = 'America/Los_Angeles' as SelectedTimezone; // UTC-8 (Jan)
const NY = 'America/New_York' as SelectedTimezone;

/**
 * Local-noon `Date` whose `yyyy-MM-dd` label is stable under any process tz —
 * the bucketers read the viewed day via `format(date)`, so a noon anchor keeps
 * that label from drifting while the window is computed in the session tz.
 */
function viewDay(year: number, monthZeroBased: number, day: number): Date {
  return new Date(year, monthZeroBased, day, 12);
}

describe('getSingleDayDrinkingSessions — buckets by each session timezone', () => {
  // 06:00 UTC on 2024-01-15 is 15:00 (Jan 15) in Tokyo but 22:00 (Jan 14) in LA.
  const crossInstant = Date.UTC(2024, 0, 15, 6, 0);
  const sessions: DrinkingSessionList = {
    tk: {start_time: crossInstant, timezone: TOKYO},
    la: {start_time: crossInstant, timezone: LA},
  };

  it('includes only the session whose own tz places the instant on that day', () => {
    const onJan15 = DSUtils.getSingleDayDrinkingSessions(
      viewDay(2024, 0, 15),
      sessions,
    ) as DrinkingSessionArray;
    expect(onJan15).toHaveLength(1);
    expect(onJan15[0].timezone).toBe(TOKYO);
  });

  it('buckets the same instant onto the previous day for a behind-UTC tz', () => {
    const onJan14 = DSUtils.getSingleDayDrinkingSessions(
      viewDay(2024, 0, 14),
      sessions,
    ) as DrinkingSessionArray;
    expect(onJan14).toHaveLength(1);
    expect(onJan14[0].timezone).toBe(LA);
  });

  it('returns the keyed subset (not an array) when returnArray is false', () => {
    const subset = DSUtils.getSingleDayDrinkingSessions(
      viewDay(2024, 0, 15),
      sessions,
      false,
    ) as DrinkingSessionList;
    expect(Object.keys(subset)).toEqual(['tk']);
  });

  it('falls back to the base timezone when a session has no timezone', () => {
    // Under the TZ=utc test process the base resolves to UTC, so 06:00 UTC on
    // 2024-01-15 belongs to Jan 15 and not Jan 14.
    const noTz: DrinkingSessionList = {x: {start_time: crossInstant}};
    expect(
      DSUtils.getSingleDayDrinkingSessions(viewDay(2024, 0, 15), noTz),
    ).toHaveLength(1);
    expect(
      DSUtils.getSingleDayDrinkingSessions(viewDay(2024, 0, 14), noTz),
    ).toHaveLength(0);
  });

  it('returns an empty array for undefined sessions', () => {
    expect(
      DSUtils.getSingleDayDrinkingSessions(viewDay(2024, 0, 15), undefined),
    ).toEqual([]);
  });
});

describe('getSingleMonthDrinkingSessions — buckets by each session timezone', () => {
  // 20:00 UTC on 2024-01-31 is 05:00 (Feb 1) in Tokyo but 12:00 (Jan 31) in LA.
  const monthEdgeInstant = Date.UTC(2024, 0, 31, 20, 0);
  const arr: DrinkingSessionArray = [
    {start_time: monthEdgeInstant, timezone: TOKYO},
    {start_time: monthEdgeInstant, timezone: LA},
  ];

  it('keeps the behind-UTC session in January and the ahead-of-UTC session in February', () => {
    const january = DSUtils.getSingleMonthDrinkingSessions(
      viewDay(2024, 0, 15),
      arr,
    );
    expect(january).toHaveLength(1);
    expect(january[0].timezone).toBe(LA);

    const february = DSUtils.getSingleMonthDrinkingSessions(
      viewDay(2024, 1, 15),
      arr,
    );
    expect(february).toHaveLength(1);
    expect(february[0].timezone).toBe(TOKYO);
  });

  it('untilToday=true drops sessions later than the current instant', () => {
    // Pin "now" so the until-today clamp is deterministic.
    jest.useFakeTimers({now: new Date('2024-01-15T12:00:00Z')});
    try {
      const sameMonth: DrinkingSessionArray = [
        {start_time: Date.UTC(2024, 0, 10, 12), timezone: UTC},
        {start_time: Date.UTC(2024, 0, 20, 12), timezone: UTC},
      ];
      const upToToday = DSUtils.getSingleMonthDrinkingSessions(
        viewDay(2024, 0, 15),
        sameMonth,
        true,
      );
      expect(upToToday).toHaveLength(1);
      expect(upToToday[0].start_time).toBe(Date.UTC(2024, 0, 10, 12));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('isDifferentDay', () => {
  it('is false when the session tz and target tz agree on the day', () => {
    // 06:00 UTC = 15:00 Jan 15 in Tokyo.
    const session: DrinkingSession = {
      start_time: Date.UTC(2024, 0, 15, 6, 0),
      timezone: TOKYO,
    };
    expect(DSUtils.isDifferentDay(session, TOKYO)).toBe(false);
  });

  it('is true when converting to the target tz crosses midnight', () => {
    // Same instant is Jan 15 in Tokyo but Jan 14 in LA.
    const session: DrinkingSession = {
      start_time: Date.UTC(2024, 0, 15, 6, 0),
      timezone: TOKYO,
    };
    expect(DSUtils.isDifferentDay(session, LA)).toBe(true);
  });

  it('does not flip the day across a same-tz DST transition', () => {
    // NY spring-forward 2025: 07:00 UTC = 03:00 EDT, still 2025-03-09.
    const session: DrinkingSession = {
      start_time: Date.UTC(2025, 2, 9, 7, 0),
      timezone: NY,
    };
    expect(DSUtils.isDifferentDay(session, NY)).toBe(false);
  });

  it('falls back to the device-formatted day when the session has no timezone', () => {
    // No session.timezone → the current day comes from the process tz (UTC here):
    // 23:30 UTC on 2024-01-15 is still Jan 15 locally, but Jan 16 in Tokyo.
    const session: DrinkingSession = {
      start_time: Date.UTC(2024, 0, 15, 23, 30),
    };
    expect(DSUtils.isDifferentDay(session, TOKYO)).toBe(true);
    expect(DSUtils.isDifferentDay(session, UTC)).toBe(false);
  });
});

const HOUR_MS = 60 * 60 * 1000;

describe('getEffectiveAutoCloseHours', () => {
  it('uses the user preference when set to a positive number', () => {
    expect(DSUtils.getEffectiveAutoCloseHours(12, 24)).toBe(12);
  });

  it('treats an explicit null user preference as a terminal opt-out', () => {
    // "Never" wins even when a global default exists.
    expect(DSUtils.getEffectiveAutoCloseHours(null, 24)).toBeNull();
  });

  it('inherits the config default when the user has no preference', () => {
    expect(DSUtils.getEffectiveAutoCloseHours(undefined, 48)).toBe(48);
  });

  it('falls back to the compile-time default when neither is set', () => {
    expect(DSUtils.getEffectiveAutoCloseHours(undefined, undefined)).toBe(
      CONST.SESSION.AUTO_CLOSE.DEFAULT_HOURS,
    );
  });

  it('honors a null config default (global never) when the user is unset', () => {
    expect(DSUtils.getEffectiveAutoCloseHours(undefined, null)).toBeNull();
  });

  it('treats a non-positive user preference as opting out', () => {
    expect(DSUtils.getEffectiveAutoCloseHours(0, 24)).toBeNull();
    expect(DSUtils.getEffectiveAutoCloseHours(-5, 24)).toBeNull();
  });

  it('treats a non-positive config default as opting out when inherited', () => {
    expect(DSUtils.getEffectiveAutoCloseHours(undefined, 0)).toBeNull();
  });
});

describe('getLastDrinkTimestamp', () => {
  it('returns the maximum drink timestamp', () => {
    const session: DrinkingSession = {
      start_time: 1000,
      drinks: {
        2000: {beer: 1},
        5000: {wine: 1},
        3000: {beer: 2},
      },
    };
    expect(DSUtils.getLastDrinkTimestamp(session)).toBe(5000);
  });

  it('falls back to start_time when there are no drinks', () => {
    const session: DrinkingSession = {start_time: 1234, drinks: {}};
    expect(DSUtils.getLastDrinkTimestamp(session)).toBe(1234);
  });

  it('falls back to start_time when drinks are undefined', () => {
    const session: DrinkingSession = {start_time: 4321};
    expect(DSUtils.getLastDrinkTimestamp(session)).toBe(4321);
  });
});

describe('isSessionStale', () => {
  const start = Date.UTC(2026, 0, 1, 18, 0); // a fixed start

  it('is stale when last activity is older than the threshold', () => {
    const session: DrinkingSession = {
      start_time: start,
      drinks: {[start + HOUR_MS]: {beer: 1}},
    };
    // Last activity = start + 1h; 25h later exceeds a 24h threshold.
    const now = start + HOUR_MS + 25 * HOUR_MS;
    expect(DSUtils.isSessionStale(session, 24, now)).toBe(true);
  });

  it('is not stale when within the threshold', () => {
    const session: DrinkingSession = {
      start_time: start,
      drinks: {[start + HOUR_MS]: {beer: 1}},
    };
    const now = start + HOUR_MS + 23 * HOUR_MS;
    expect(DSUtils.isSessionStale(session, 24, now)).toBe(false);
  });

  it('measures from last activity, not start_time (a long active night)', () => {
    // Started 30h ago but a drink was logged 1h ago → not stale at 24h.
    const now = start + 30 * HOUR_MS;
    const session: DrinkingSession = {
      start_time: start,
      drinks: {[now - HOUR_MS]: {beer: 1}},
    };
    expect(DSUtils.isSessionStale(session, 24, now)).toBe(false);
  });

  it('uses start_time as activity when the session has no drinks', () => {
    const session: DrinkingSession = {start_time: start, drinks: {}};
    expect(DSUtils.isSessionStale(session, 24, start + 25 * HOUR_MS)).toBe(
      true,
    );
    expect(DSUtils.isSessionStale(session, 24, start + 23 * HOUR_MS)).toBe(
      false,
    );
  });

  it('is never stale when the threshold is null (never)', () => {
    const session: DrinkingSession = {start_time: start, drinks: {}};
    expect(DSUtils.isSessionStale(session, null, start + 1000 * HOUR_MS)).toBe(
      false,
    );
  });

  it('is stale exactly at the threshold boundary', () => {
    const session: DrinkingSession = {start_time: start, drinks: {}};
    expect(DSUtils.isSessionStale(session, 24, start + 24 * HOUR_MS)).toBe(
      true,
    );
  });
});

describe('buildAutoClosedSession', () => {
  it('sets ongoing false, the auto_closed marker, and end_time to the last drink', () => {
    const session: DrinkingSession = {
      id: 'abc',
      start_time: 1000,
      ongoing: true,
      drinks: {2000: {beer: 1}, 6000: {wine: 1}},
    };
    const closed = DSUtils.buildAutoClosedSession(session);
    expect(closed.ongoing).toBe(false);
    expect(closed.auto_closed).toBe(true);
    expect(closed.end_time).toBe(6000);
  });

  it('uses start_time as end_time when there are no drinks', () => {
    const session: DrinkingSession = {
      id: 'abc',
      start_time: 1000,
      ongoing: true,
      drinks: {},
    };
    const closed = DSUtils.buildAutoClosedSession(session);
    expect(closed.end_time).toBe(1000);
  });

  it('does not mutate the input session', () => {
    const session: DrinkingSession = {
      id: 'abc',
      start_time: 1000,
      ongoing: true,
      drinks: {2000: {beer: 1}},
    };
    DSUtils.buildAutoClosedSession(session);
    expect(session.ongoing).toBe(true);
    expect(session.auto_closed).toBeUndefined();
    expect(session.end_time).toBeUndefined();
  });
});
