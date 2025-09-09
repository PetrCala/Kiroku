import Onyx from 'react-native-onyx';
import {
  buildDayRollups,
  buildDayRollupsFromSessions,
} from '@libs/Analytics/rollups';
import type {Drinks, DrinksList, DrinksToUnits} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {DrinkingSessionList} from '@src/types/onyx/DrinkingSession';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {randDrinkingSession} from '../../../utils/collections/drinkingSessions';
import waitForBatchedUpdates from '../../../utils/waitForBatchedUpdates';

/* eslint-disable @typescript-eslint/naming-convention */

jest.mock('@libs/DateUtils', () => ({
  __esModule: true,
  default: {
    getLocalizedDay: jest.fn(date => {
      if (!date) {
        return 'unknown';
      }
      const d = new Date(date as string);
      if (Number.isNaN(d.getTime())) {
        return 'unknown';
      }
      return d.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }),
    getLocalizedTime: jest.fn(date => {
      if (!date) {
        return 'unknown';
      }
      const d = new Date(date as string);
      if (Number.isNaN(d.getTime())) {
        return 'unknown';
      }
      const result = d.toISOString().replace('Z', '+00:00');
      return result;
    }),
  },
}));

const UTC = 'UTC';

describe('buildDayRollups', () => {
  let mockDrinksToUnits: DrinksToUnits;
  let mockUserId: UserID;
  let mockDrinksList: DrinksList;

  beforeAll(() => {
    Onyx.init({
      keys: ONYXKEYS,
      initialKeyStates: {
        [ONYXKEYS.SESSION]: {
          userID: '999',
        },
        [ONYXKEYS.USER_DATA_LIST]: {
          '999': {
            timezone: {
              // UTC is not recognized as a valid timezone but
              // in these tests we want to use it to avoid issues
              // because of daylight saving time
              selected: UTC as SelectedTimezone,
            },
          },
        },
      },
    });
    return waitForBatchedUpdates();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    Onyx.clear();
  });

  beforeEach(() => {
    mockUserId = 'test-user-123';
    mockDrinksToUnits = {
      [CONST.DRINKS.KEYS.SMALL_BEER]: 0.5,
      [CONST.DRINKS.KEYS.BEER]: 1.0,
      [CONST.DRINKS.KEYS.COCKTAIL]: 1.5,
      [CONST.DRINKS.KEYS.OTHER]: 1.0,
      [CONST.DRINKS.KEYS.STRONG_SHOT]: 2.0,
      [CONST.DRINKS.KEYS.WEAK_SHOT]: 1.0,
      [CONST.DRINKS.KEYS.WINE]: 1.5,
    };
    mockDrinksList = {};
  });

  describe('basic functionality', () => {
    it('should return empty array for empty drinks list', () => {
      const result = buildDayRollups({}, mockDrinksToUnits, mockUserId);
      expect(result).toEqual([]);
    });

    it('should process valid drinks data correctly', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 2,
          [CONST.DRINKS.KEYS.WINE]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: mockUserId,
        totalSdu: 3.5, // (2 * 1.0) + (1 * 1.5)
        drinksCount: 2,
        byType: {
          [CONST.DRINKS.KEYS.BEER]: 2.0,
          [CONST.DRINKS.KEYS.WINE]: 1.5,
        },
      });
      expect(result[0].dateKey).toBeDefined();
    });

    it('should aggregate multiple drinks on the same day', () => {
      const timestamp1 = new Date('2024-01-15T10:30:00.000Z').getTime();
      const timestamp2 = new Date('2024-01-15T15:45:00.000Z').getTime();
      mockDrinksList = {
        [timestamp1]: {
          [CONST.DRINKS.KEYS.BEER]: 1,
        },
        [timestamp2]: {
          [CONST.DRINKS.KEYS.BEER]: 2,
          [CONST.DRINKS.KEYS.WINE]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].totalSdu).toBe(4.5); // (1 * 1.0) + (2 * 1.0) + (1 * 1.5)
      expect(result[0].drinksCount).toBe(3);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(3.0);
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBe(1.5);
    });

    it('should handle drinks across multiple days', () => {
      const timestamp1 = new Date('2024-01-15T10:30:00.000Z').getTime();
      const timestamp2 = new Date('2024-01-16T15:45:00.000Z').getTime();
      mockDrinksList = {
        [timestamp1]: {
          [CONST.DRINKS.KEYS.BEER]: 2,
        },
        [timestamp2]: {
          [CONST.DRINKS.KEYS.WINE]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(2);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(2.0);
      expect(result[1].byType[CONST.DRINKS.KEYS.WINE]).toBe(1.5);
    });
  });

  describe('data validation and error handling', () => {
    it('should skip invalid timestamps', () => {
      mockDrinksList = {
        ['invalid-timestamp' as unknown as number]: {
          [CONST.DRINKS.KEYS.BEER]: 1,
        },
        [new Date('2024-01-15T10:30:00.000Z').getTime()]: {
          [CONST.DRINKS.KEYS.WINE]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBe(1.5);
    });

    it('should skip invalid drinks objects', () => {
      const timestamp1 = new Date('2024-01-15T10:30:00.000Z').getTime();
      const timestamp2 = new Date('2024-01-15T15:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp1]: null as unknown as Drinks,
        [timestamp2]: {
          [CONST.DRINKS.KEYS.BEER]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(1.0);
    });

    it('should skip invalid drink values', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 'invalid' as unknown as number,
          [CONST.DRINKS.KEYS.WINE]: -1,
          [CONST.DRINKS.KEYS.STRONG_SHOT]: 2,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.STRONG_SHOT]).toBe(4.0);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBeUndefined();
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBeUndefined();
    });

    it('should handle zero drink values', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 0,
          [CONST.DRINKS.KEYS.WINE]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBeUndefined();
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBe(1.5);
    });
  });

  describe('timestamp handling', () => {
    it('should debug timestamp issue', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('firstTs');
      expect(result[0]).toHaveProperty('lastTs');
    });

    it('should set firstTs and lastTs correctly', () => {
      const timestamp1 = new Date('2024-01-15T10:30:00.000Z').getTime();
      const timestamp2 = new Date('2024-01-15T15:45:00.000Z').getTime();
      mockDrinksList = {
        [timestamp1]: {
          [CONST.DRINKS.KEYS.BEER]: 1,
        },
        [timestamp2]: {
          [CONST.DRINKS.KEYS.WINE]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].firstTs).toBeDefined();
      expect(result[0].lastTs).toBeDefined();
      expect(result[0].firstTs).not.toBe(result[0].lastTs);
    });

    it('should handle timestamp processing correctly', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 1,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].firstTs).toBeDefined();
      expect(result[0].lastTs).toBeDefined();
    });
  });

  describe('SDU calculations', () => {
    it('should calculate SDU correctly for different drink types', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 2, // 2 * 1.0 = 2.0 SDU
          [CONST.DRINKS.KEYS.WINE]: 1, // 1 * 1.5 = 1.5 SDU
          [CONST.DRINKS.KEYS.STRONG_SHOT]: 1, // 1 * 2.0 = 2.0 SDU
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result[0].totalSdu).toBe(5.5);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(2.0);
      expect(result[0].byType[CONST.DRINKS.KEYS.WINE]).toBe(1.5);
      expect(result[0].byType[CONST.DRINKS.KEYS.STRONG_SHOT]).toBe(2.0);
    });

    it('should round totalSdu to 2 decimal places', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 1.333,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result[0].totalSdu).toBe(1.33);
    });
  });

  describe('edge cases', () => {
    it('should handle empty drinks object', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {},
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(0);
    });

    it('should handle drinks with unknown drink keys', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 1,
          unknown_drink: 2,
        } as unknown as Drinks,
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(1.0);
      expect(
        (result[0].byType as Record<string, number>).unknown_drink,
      ).toBeUndefined();
    });

    it('should handle very large numbers', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z').getTime();
      mockDrinksList = {
        [timestamp]: {
          [CONST.DRINKS.KEYS.BEER]: 1000000,
        },
      };

      const result = buildDayRollups(
        mockDrinksList,
        mockDrinksToUnits,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].totalSdu).toBe(1000000);
      expect(result[0].drinksCount).toBe(1);
    });
  });
});

describe('buildDayRollupsFromSessions', () => {
  let mockDrinksToUnits: DrinksToUnits;
  let mockUserId: UserID;
  let mockDrinkingSessions: DrinkingSessionList;

  beforeAll(() => {
    Onyx.init({
      keys: ONYXKEYS,
      initialKeyStates: {
        [ONYXKEYS.SESSION]: {
          userID: '999',
        },
        [ONYXKEYS.USER_DATA_LIST]: {
          '999': {
            timezone: {
              selected: UTC as SelectedTimezone,
            },
          },
        },
      },
    });
    return waitForBatchedUpdates();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    Onyx.clear();
  });

  beforeEach(() => {
    mockUserId = 'test-user-123';
    mockDrinksToUnits = {
      [CONST.DRINKS.KEYS.SMALL_BEER]: 0.5,
      [CONST.DRINKS.KEYS.BEER]: 1.0,
      [CONST.DRINKS.KEYS.COCKTAIL]: 1.5,
      [CONST.DRINKS.KEYS.OTHER]: 1.0,
      [CONST.DRINKS.KEYS.STRONG_SHOT]: 2.0,
      [CONST.DRINKS.KEYS.WEAK_SHOT]: 1.0,
      [CONST.DRINKS.KEYS.WINE]: 1.5,
    };
    mockDrinkingSessions = {};
  });

  it('should return empty array for undefined sessions', () => {
    const result = buildDayRollupsFromSessions(
      undefined,
      mockDrinksToUnits,
      mockUserId,
    );

    expect(result).toEqual([]);
  });

  it('should return empty array for empty sessions', () => {
    const result = buildDayRollupsFromSessions(
      {},
      mockDrinksToUnits,
      mockUserId,
    );

    expect(result).toEqual([]);
  });

  it('should process drinking sessions correctly', () => {
    const session1 = randDrinkingSession(new Date().getTime());
    const session2 = randDrinkingSession(new Date().getTime() - 86400000); // 1 day ago
    mockDrinkingSessions = {
      'session-1': session1,
      'session-2': session2,
    };

    // Mock the transform function
    const mockDrinksList = {
      '2024-01-15T10:30:00.000Z': {
        [CONST.DRINKS.KEYS.BEER]: 2,
      },
    };

    jest
      .spyOn(DSUtils, 'transformDrinkingSessionsToDrinksList')
      .mockReturnValue(mockDrinksList);

    const result = buildDayRollupsFromSessions(
      mockDrinkingSessions,
      mockDrinksToUnits,
      mockUserId,
    );

    expect(DSUtils.transformDrinkingSessionsToDrinksList).toHaveBeenCalledWith(
      mockDrinkingSessions,
    );
    expect(result).toHaveLength(1);
    expect(result[0].byType[CONST.DRINKS.KEYS.BEER]).toBe(2.0);
  });

  it('should handle transform function returning empty list', () => {
    jest
      .spyOn(DSUtils, 'transformDrinkingSessionsToDrinksList')
      .mockReturnValue({});

    const result = buildDayRollupsFromSessions(
      mockDrinkingSessions,
      mockDrinksToUnits,
      mockUserId,
    );

    expect(result).toEqual([]);
  });
});

describe('integration with real data', () => {
  beforeAll(() => {
    Onyx.init({
      keys: ONYXKEYS,
      initialKeyStates: {
        [ONYXKEYS.SESSION]: {
          userID: '999',
        },
        [ONYXKEYS.USER_DATA_LIST]: {
          '999': {
            timezone: {
              selected: UTC as SelectedTimezone,
            },
          },
        },
      },
    });
    return waitForBatchedUpdates();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    Onyx.clear();
  });

  it('should handle realistic drinks list', () => {
    const mockDrinksToUnits = {
      [CONST.DRINKS.KEYS.SMALL_BEER]: 0.5,
      [CONST.DRINKS.KEYS.BEER]: 1.0,
      [CONST.DRINKS.KEYS.COCKTAIL]: 1.5,
      [CONST.DRINKS.KEYS.OTHER]: 1.0,
      [CONST.DRINKS.KEYS.STRONG_SHOT]: 2.0,
      [CONST.DRINKS.KEYS.WEAK_SHOT]: 1.0,
      [CONST.DRINKS.KEYS.WINE]: 1.5,
    };

    // Create a realistic drinks list with known valid timestamps
    const realisticDrinksList: DrinksList = {
      [new Date('2024-01-15T10:30:00.000Z').getTime()]: {
        [CONST.DRINKS.KEYS.BEER]: 2,
        [CONST.DRINKS.KEYS.WINE]: 1,
      },
      [new Date('2024-01-16T15:45:00.000Z').getTime()]: {
        [CONST.DRINKS.KEYS.STRONG_SHOT]: 1,
        [CONST.DRINKS.KEYS.OTHER]: 2,
      },
    };

    const result = buildDayRollups(
      realisticDrinksList,
      mockDrinksToUnits,
      'user-123',
    );

    // Should have processed all valid entries
    expect(result.length).toBe(2);
    expect(result.every(rollup => rollup.userId === 'user-123')).toBe(true);
    expect(result.every(rollup => typeof rollup.totalSdu === 'number')).toBe(
      true,
    );
    expect(result.every(rollup => rollup.totalSdu >= 0)).toBe(true);
  });
});
