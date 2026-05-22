import {renderHook} from '@testing-library/react-native';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useCalendarHeatmap from '@hooks/useStatistics/useCalendarHeatmap';
import CONST from '@src/CONST';
import type {DrinkingSessionList} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

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

const DRINKS_TO_UNITS = {
  [CONST.DRINKS.KEYS.SMALL_BEER]: 0.5,
  [CONST.DRINKS.KEYS.BEER]: 1.0,
  [CONST.DRINKS.KEYS.COCKTAIL]: 1.5,
  [CONST.DRINKS.KEYS.OTHER]: 1.0,
  [CONST.DRINKS.KEYS.STRONG_SHOT]: 2.0,
  [CONST.DRINKS.KEYS.WEAK_SHOT]: 1.0,
  [CONST.DRINKS.KEYS.WINE]: 1.5,
};

function configure(sessions: DrinkingSessionList | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: {currentUser: {uid: UID}},
  } as unknown as ReturnType<typeof useFirebase>);
  mockedUseDatabaseData.mockReturnValue({
    drinkingSessionData: sessions,
    preferences: {
      drinks_to_units: DRINKS_TO_UNITS,
      first_day_of_week: 'Monday',
    },
    userData: {timezone: {selected: UTC}},
    isFetchingOlderMonths: false,
  } as unknown as ReturnType<typeof useDatabaseData>);
}

describe('useCalendarHeatmap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns isLoading + empty data while context is hydrating', () => {
    configure(undefined);
    const {result} = renderHook(() => useCalendarHeatmap());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('emits one cell per day of the target month', () => {
    configure({});
    const {result} = renderHook(() =>
      useCalendarHeatmap({monthAnchor: new Date(Date.UTC(2024, 0, 15))}),
    );
    expect(result.current.isLoading).toBe(false);
    // January has 31 days
    expect(result.current.data).toHaveLength(31);
    expect(result.current.data[0].dateKey).toBe('2024-01-01');
    expect(result.current.data[30].dateKey).toBe('2024-01-31');
  });

  it('fills in totalSdu for days with rollups', () => {
    const sessions: DrinkingSessionList = {
      s1: {
        start_time: Date.UTC(2024, 0, 10, 10),
        drinks: {
          [Date.UTC(2024, 0, 10, 10)]: {[CONST.DRINKS.KEYS.BEER]: 3},
        },
      },
    };
    configure(sessions);
    const {result} = renderHook(() =>
      useCalendarHeatmap({monthAnchor: new Date(Date.UTC(2024, 0, 15))}),
    );
    const cell = result.current.data.find(c => c.dateKey === '2024-01-10');
    expect(cell?.totalSdu).toBe(3);
    expect(cell?.intensity).toBeGreaterThan(0);
  });
});
