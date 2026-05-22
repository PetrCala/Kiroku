import {renderHook} from '@testing-library/react-native';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useStatisticsRollups from '@hooks/useStatistics/useStatisticsRollups';
import CONST from '@src/CONST';
import type {DrinkingSessionList} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

/* eslint-disable @typescript-eslint/naming-convention -- drink keys / date keys */

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: jest.fn(),
}));

jest.mock('@context/global/DatabaseDataContext', () => ({
  useDatabaseData: jest.fn(),
}));

const mockedUseFirebase = jest.mocked(useFirebase);
const mockedUseDatabaseData = jest.mocked(useDatabaseData);

const UID = 'user-1';
const UTC = 'UTC' as SelectedTimezone;

function setAuth(uid: string | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: uid ? {currentUser: {uid}} : {currentUser: null},
  } as unknown as ReturnType<typeof useFirebase>);
}

function setData(args: {
  sessions?: DrinkingSessionList;
  drinksToUnits?: Record<string, number>;
  timezone?: SelectedTimezone;
  firstDay?: 'Monday' | 'Sunday';
}): void {
  mockedUseDatabaseData.mockReturnValue({
    drinkingSessionData: args.sessions,
    preferences:
      args.drinksToUnits || args.firstDay
        ? {
            drinks_to_units: args.drinksToUnits,
            first_day_of_week: args.firstDay ?? 'Monday',
          }
        : undefined,
    userData: args.timezone ? {timezone: {selected: args.timezone}} : undefined,
    isFetchingOlderMonths: false,
  } as unknown as ReturnType<typeof useDatabaseData>);
}

const DRINKS_TO_UNITS = {
  [CONST.DRINKS.KEYS.SMALL_BEER]: 0.5,
  [CONST.DRINKS.KEYS.BEER]: 1.0,
  [CONST.DRINKS.KEYS.COCKTAIL]: 1.5,
  [CONST.DRINKS.KEYS.OTHER]: 1.0,
  [CONST.DRINKS.KEYS.STRONG_SHOT]: 2.0,
  [CONST.DRINKS.KEYS.WEAK_SHOT]: 1.0,
  [CONST.DRINKS.KEYS.WINE]: 1.5,
};

describe('useStatisticsRollups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuth(UID);
  });

  it('reports isLoading when preferences are missing', () => {
    setData({sessions: {}, timezone: UTC});
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.isEmpty).toBe(false);
  });

  it('reports isLoading when sessions are still undefined', () => {
    setData({drinksToUnits: DRINKS_TO_UNITS, timezone: UTC});
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.isLoading).toBe(true);
  });

  it('reports isEmpty once loaded with no rollups', () => {
    setData({
      sessions: {},
      drinksToUnits: DRINKS_TO_UNITS,
      timezone: UTC,
    });
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('produces day rollups when sessions have valid drinks', () => {
    const sessions: DrinkingSessionList = {
      s1: {
        start_time: Date.UTC(2024, 0, 15, 10),
        drinks: {
          [Date.UTC(2024, 0, 15, 10, 30)]: {
            [CONST.DRINKS.KEYS.BEER]: 2,
          },
        },
      },
    };
    setData({sessions, drinksToUnits: DRINKS_TO_UNITS, timezone: UTC});
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].dateKey).toBe('2024-01-15');
    expect(result.current.data[0].totalSdu).toBe(2);
  });

  it('builds parallel sessionCountsByDay bucketed by start_time', () => {
    const sessions: DrinkingSessionList = {
      s1: {
        start_time: Date.UTC(2024, 0, 15, 10),
        drinks: {
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        },
      },
      s2: {
        start_time: Date.UTC(2024, 0, 15, 20),
        drinks: {
          [Date.UTC(2024, 0, 15, 20)]: {[CONST.DRINKS.KEYS.WINE]: 1},
        },
      },
      s3: {
        start_time: Date.UTC(2024, 0, 16, 10),
        drinks: {
          [Date.UTC(2024, 0, 16, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        },
      },
    };
    setData({sessions, drinksToUnits: DRINKS_TO_UNITS, timezone: UTC});
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.sessionCountsByDay).toEqual({
      '2024-01-15': 2,
      '2024-01-16': 1,
    });
  });

  it('threads weekStartsOn from first_day_of_week preference', () => {
    setData({
      sessions: {},
      drinksToUnits: DRINKS_TO_UNITS,
      timezone: UTC,
      firstDay: 'Sunday',
    });
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.weekStartsOn).toBe(0);
  });

  it('defaults weekStartsOn to Monday (1) when preference is missing', () => {
    setData({sessions: {}, drinksToUnits: DRINKS_TO_UNITS, timezone: UTC});
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.weekStartsOn).toBe(1);
  });

  it('falls back to CONST.DEFAULT_TIME_ZONE when userData has no timezone', () => {
    setData({sessions: {}, drinksToUnits: DRINKS_TO_UNITS});
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.timezone).toBe(CONST.DEFAULT_TIME_ZONE.selected);
  });

  it('uses the auth UID for the userId stamp on rollups', () => {
    const sessions: DrinkingSessionList = {
      s1: {
        start_time: Date.UTC(2024, 0, 15, 10),
        drinks: {
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        },
      },
    };
    setData({sessions, drinksToUnits: DRINKS_TO_UNITS, timezone: UTC});
    const {result} = renderHook(() => useStatisticsRollups());
    expect(result.current.userId).toBe(UID);
    expect(result.current.data[0].userId).toBe(UID);
  });

  it('returns a stable rollups reference across re-renders when inputs are unchanged', () => {
    const sessions: DrinkingSessionList = {
      s1: {
        start_time: Date.UTC(2024, 0, 15, 10),
        drinks: {
          [Date.UTC(2024, 0, 15, 10)]: {[CONST.DRINKS.KEYS.BEER]: 1},
        },
      },
    };
    setData({sessions, drinksToUnits: DRINKS_TO_UNITS, timezone: UTC});
    const {result, rerender} = renderHook(() => useStatisticsRollups());
    const first = result.current.data;
    rerender({});
    expect(result.current.data).toBe(first);
  });
});
