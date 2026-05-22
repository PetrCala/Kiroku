import CONST from '@src/CONST';
import buildDayRollups from '@libs/Statistics/rollups';
import type {DrinkingSession, DrinksList} from '@src/types/onyx';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const USER_ID = 'test-user-123';
const UTC = 'UTC' as SelectedTimezone;
const PRAGUE = 'Europe/Prague' as SelectedTimezone;

const drinksToUnits: DrinksToUnits = {
  [CONST.DRINKS.KEYS.SMALL_BEER]: 0.5,
  [CONST.DRINKS.KEYS.BEER]: 1.0,
  [CONST.DRINKS.KEYS.COCKTAIL]: 1.5,
  [CONST.DRINKS.KEYS.OTHER]: 1.0,
  [CONST.DRINKS.KEYS.STRONG_SHOT]: 2.0,
  [CONST.DRINKS.KEYS.WEAK_SHOT]: 1.0,
  [CONST.DRINKS.KEYS.WINE]: 1.5,
};

function mkSession(
  drinks: DrinksList,
  overrides?: Partial<DrinkingSession>,
): DrinkingSession {
  const timestamps = Object.keys(drinks).map(Number);
  const startTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  return {
    start_time: startTime,
    drinks,
    ...overrides,
  };
}

describe('buildDayRollups', () => {
  describe('empty / invalid inputs', () => {
    it('returns [] for undefined sessions', () => {
      expect(buildDayRollups(undefined, drinksToUnits, UTC, USER_ID)).toEqual(
        [],
      );
    });

    it('returns [] for empty sessions', () => {
      expect(buildDayRollups({}, drinksToUnits, UTC, USER_ID)).toEqual([]);
    });

    it('returns [] when drinksToUnits is missing', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
      };
      expect(buildDayRollups(sessions, undefined, UTC, USER_ID)).toEqual([]);
    });

    it('returns [] when every session has no drinks', () => {
      const sessions = {
        s1: {start_time: Date.UTC(2024, 0, 15, 10)},
        s2: {start_time: Date.UTC(2024, 0, 16, 10), drinks: {}},
      };
      expect(buildDayRollups(sessions, drinksToUnits, UTC, USER_ID)).toEqual(
        [],
      );
    });
  });

  describe('basic aggregation', () => {
    it('builds a row for a single drink', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10, 30)]: {
            [CONST.DRINKS.KEYS.BEER]: 2,
            [CONST.DRINKS.KEYS.WINE]: 1,
          },
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: USER_ID,
        dateKey: '2024-01-15',
        totalSdu: 3.5,
        drinksCount: 2,
        byType: {
          [CONST.DRINKS.KEYS.BEER]: 2.0,
          [CONST.DRINKS.KEYS.WINE]: 1.5,
        },
      });
    });

    it('aggregates multiple drink-timestamps on the same day within one session', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10, 30)]: {[CONST.DRINKS.KEYS.BEER]: 1},
          [Date.UTC(2024, 0, 15, 15, 45)]: {
            [CONST.DRINKS.KEYS.BEER]: 2,
            [CONST.DRINKS.KEYS.WINE]: 1,
          },
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].totalSdu).toBe(4.5);
      expect(result[0].drinksCount).toBe(3);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(3.0);
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBe(1.5);
    });

    it('aggregates across multiple sessions on the same day', () => {
      const sessions = {
        morning: mkSession({
          [Date.UTC(2024, 0, 15, 9)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
        evening: mkSession({
          [Date.UTC(2024, 0, 15, 20)]: {[CONST.DRINKS.KEYS.WINE]: 2},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].drinksCount).toBe(2);
      expect(result[0].totalSdu).toBe(4.0);
    });

    it('produces one row per day, sorted ascending', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 16, 10)]: {[CONST.DRINKS.KEYS.WINE]: 1},
        }),
        s2: mkSession({
          [Date.UTC(2024, 0, 14, 10)]: {[CONST.DRINKS.KEYS.BEER]: 2},
        }),
        s3: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.COCKTAIL]: 1},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result.map(r => r.dateKey)).toEqual([
        '2024-01-14',
        '2024-01-15',
        '2024-01-16',
      ]);
    });

    it('stamps every row with the userId', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
        s2: mkSession({
          [Date.UTC(2024, 0, 16, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result.every(r => r.userId === USER_ID)).toBe(true);
    });
  });

  describe('session-level filtering', () => {
    it('excludes ongoing sessions', () => {
      const sessions = {
        finished: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
        live: mkSession(
          {[Date.UTC(2024, 0, 16, 10)]: {[CONST.DRINKS.KEYS.WINE]: 5}},
          {ongoing: true},
        ),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].dateKey).toBe('2024-01-15');
    });

    it('ignores null sessions', () => {
      const sessions = {
        good: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
        broken: null as unknown as DrinkingSession,
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('per-drink validation', () => {
    it('skips invalid drink timestamps', () => {
      const sessions = {
        s1: mkSession({
          ['not-a-number' as unknown as number]: {[CONST.DRINKS.KEYS.BEER]: 1},
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.WINE]: 1},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBe(1.5);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBeUndefined();
    });

    it('skips null drinks objects under valid timestamps', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: null as unknown as DrinksList[number],
          [Date.UTC(2024, 0, 15, 15)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(1.0);
    });

    it('skips non-finite, negative, and zero values', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {
            [CONST.DRINKS.KEYS.BEER]: 'oops' as unknown as number,
            [CONST.DRINKS.KEYS.WINE]: -1,
            [CONST.DRINKS.KEYS.COCKTAIL]: 0,
            [CONST.DRINKS.KEYS.STRONG_SHOT]: 2,
          },
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.STRONG_SHOT]).toBe(4.0);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBeUndefined();
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBeUndefined();
      expect(result[0].byType[CONST.DRINKS.KEYS.COCKTAIL]).toBeUndefined();
    });

    it('skips drink keys with no entry in drinksToUnits', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {
            [CONST.DRINKS.KEYS.BEER]: 1,
            unknown_drink: 5,
          } as DrinksList[number],
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(1.0);
      expect(
        (result[0].byType as Record<string, number>).unknown_drink,
      ).toBeUndefined();
    });

    it('omits the day row entirely if every drink is invalid', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {
            [CONST.DRINKS.KEYS.BEER]: 0,
            [CONST.DRINKS.KEYS.WINE]: -1,
          },
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toEqual([]);
    });
  });

  describe('SDU math', () => {
    it('multiplies amounts by their drinksToUnits mapping', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {
            [CONST.DRINKS.KEYS.BEER]: 2,
            [CONST.DRINKS.KEYS.WINE]: 1,
            [CONST.DRINKS.KEYS.STRONG_SHOT]: 1,
          },
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result[0].totalSdu).toBe(5.5);
    });

    it('rounds totalSdu to two decimal places', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1.333},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result[0].totalSdu).toBe(1.33);
    });

    it('handles very large amounts without overflow', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1_000_000},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result[0].totalSdu).toBe(1_000_000);
      expect(result[0].drinksCount).toBe(1);
    });
  });

  describe('timezone behaviour', () => {
    it('is pure — same input + tz arg yields the same output regardless of call order', () => {
      const sessions = {
        s1: mkSession({
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        }),
      };
      const a = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      const b = buildDayRollups(sessions, drinksToUnits, PRAGUE, USER_ID);
      const c = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(a).toEqual(c);
      // Sanity check: Prague and UTC produce the same dateKey here (10:00 UTC = 11:00 CET, same day)
      expect(b[0].dateKey).toBe('2024-01-15');
    });

    it('buckets near-midnight drinks differently in different timezones', () => {
      // 2024-01-15T23:30:00Z is 2024-01-16T00:30 in Prague (CET, UTC+1)
      const ts = Date.UTC(2024, 0, 15, 23, 30);
      const sessions = {
        s1: mkSession({[ts]: {[CONST.DRINKS.KEYS.BEER]: 1}}),
      };
      const utc = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      const pragueSessions = {
        s1: mkSession(
          {[ts]: {[CONST.DRINKS.KEYS.BEER]: 1}},
          {
            timezone: PRAGUE,
          },
        ),
      };
      const prague = buildDayRollups(
        pragueSessions,
        drinksToUnits,
        UTC,
        USER_ID,
      );
      expect(utc[0].dateKey).toBe('2024-01-15');
      expect(prague[0].dateKey).toBe('2024-01-16');
    });

    it('honors per-session timezone over the argument timezone', () => {
      const ts = Date.UTC(2024, 0, 15, 23, 30);
      const sessions = {
        traveled: mkSession(
          {[ts]: {[CONST.DRINKS.KEYS.BEER]: 1}},
          {
            timezone: PRAGUE,
          },
        ),
      };
      // Argument timezone is UTC but the session's own timezone (Prague) wins
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result[0].dateKey).toBe('2024-01-16');
    });

    it('survives DST transitions without producing duplicate days', () => {
      // Europe/Prague DST began 2024-03-31. A drink at 01:30 local on that
      // day still resolves to a single 'YYYY-MM-DD' key.
      const tsBefore = Date.UTC(2024, 2, 31, 0, 30); // 01:30 CET
      const tsAfter = Date.UTC(2024, 2, 31, 1, 30); // 03:30 CEST
      const sessions = {
        s1: mkSession({
          [tsBefore]: {[CONST.DRINKS.KEYS.BEER]: 1},
          [tsAfter]: {[CONST.DRINKS.KEYS.WINE]: 1},
        }),
      };
      const result = buildDayRollups(sessions, drinksToUnits, PRAGUE, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].dateKey).toBe('2024-03-31');
      expect(result[0].drinksCount).toBe(2);
    });
  });

  describe('regressions — defects from origin/feat/graphs to NOT reintroduce', () => {
    it('does not collapse per-drink timestamps to session.start_time', () => {
      // Session starts on 2024-01-14, but a drink is logged on 2024-01-15.
      // The day rollup must reflect the drink's own timestamp, not the
      // session's start_time.
      const sessions = {
        spanning: mkSession(
          {[Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1}},
          {start_time: Date.UTC(2024, 0, 14, 22)},
        ),
      };
      const result = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].dateKey).toBe('2024-01-15');
    });

    it('does not read timezone from a module-level global', () => {
      // If a hidden module-mutable timezone existed, calling with UTC after
      // calling with Prague would leak state. Verify both calls return
      // exactly the result for their own timezone argument.
      const ts = Date.UTC(2024, 0, 15, 23, 30);
      const sessions = {
        s1: mkSession({[ts]: {[CONST.DRINKS.KEYS.BEER]: 1}}),
      };
      const pragueFirst = buildDayRollups(
        sessions,
        drinksToUnits,
        PRAGUE,
        USER_ID,
      );
      const utcAfter = buildDayRollups(sessions, drinksToUnits, UTC, USER_ID);
      expect(pragueFirst[0].dateKey).toBe('2024-01-16');
      expect(utcAfter[0].dateKey).toBe('2024-01-15');
    });
  });
});
