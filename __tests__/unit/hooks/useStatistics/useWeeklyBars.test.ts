import {renderHook} from '@testing-library/react-native';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useWeeklyBars from '@hooks/useStatistics/useWeeklyBars';
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

describe('useWeeklyBars', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns isLoading + an empty result while context is hydrating', () => {
    configure(undefined);
    const {result} = renderHook(() => useWeeklyBars());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data.bars).toEqual([]);
    expect(result.current.data.band).toEqual({p25: 0, p75: 0});
  });

  it('emits 8 bars by default', () => {
    configure({});
    const {result} = renderHook(() => useWeeklyBars());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data.bars).toHaveLength(8);
  });

  it('honors the weeks option', () => {
    configure({});
    const {result} = renderHook(() => useWeeklyBars({weeks: 4}));
    expect(result.current.data.bars).toHaveLength(4);
  });
});
