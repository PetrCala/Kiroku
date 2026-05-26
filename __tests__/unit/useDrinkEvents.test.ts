/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {act, renderHook} from '@testing-library/react-native';
import {InteractionManager} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useDrinkEvents from '@hooks/useStatistics/useDrinkEvents';
import type {Preferences, UserData} from '@src/types/onyx';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  useOnyx: jest.fn(),
  default: {},
}));

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: jest.fn(),
}));

jest.mock('@context/global/DatabaseDataContext', () => ({
  useDatabaseData: jest.fn(),
}));

jest.mock('@hooks/useCurrentUserData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedUseFirebase = jest.mocked(useFirebase);
const mockedUseDatabaseData = jest.mocked(useDatabaseData);
const mockedUseCurrentUserData = jest.mocked(useCurrentUserData);

function makePreferences(): Preferences {
  return {
    first_day_of_week: 'Monday',
    units_to_colors: {orange: 10, yellow: 5},
    drinks_to_units: {
      small_beer: 0.5,
      beer: 1,
      cocktail: 1.5,
      other: 1,
      strong_shot: 1,
      weak_shot: 0.5,
      wine: 1,
    },
    theme: 'system',
  } as unknown as Preferences;
}

function makeUserData(): UserData {
  return {
    timezone: {selected: 'Africa/Abidjan', automatic: true},
  } as unknown as UserData;
}

function setAuth(uid: string | undefined): void {
  mockedUseFirebase.mockReturnValue({
    auth: uid ? {currentUser: {uid}} : {currentUser: null},
  } as unknown as ReturnType<typeof useFirebase>);
}

function setOnyx(
  value: UserDrinkingSessionsList | undefined,
  status: 'loading' | 'loaded',
): void {
  mockedUseOnyx.mockReturnValue([value, {status}] as ReturnType<
    typeof useOnyx
  >);
}

function setContexts(
  preferences: Preferences | undefined = makePreferences(),
  userData: UserData | undefined = makeUserData(),
): void {
  mockedUseDatabaseData.mockReturnValue({
    preferences,
    isFetchingOlderMonths: false,
  });
  mockedUseCurrentUserData.mockReturnValue(userData ?? {});
}

// A fixed UTC timestamp: 2025-06-12T15:00:00Z (Thursday).
const TS_U1_A = Date.UTC(2025, 5, 12, 15, 0, 0);
const TS_U1_B = Date.UTC(2025, 5, 12, 16, 30, 0);
const TS_U2_A = Date.UTC(2025, 5, 13, 20, 0, 0);

function makeSessions(): UserDrinkingSessionsList {
  return {
    u1: {
      s1: {
        start_time: TS_U1_A,
        end_time: TS_U1_A + 90 * 60_000,
        timezone: 'Africa/Abidjan',
        drinks: {
          [TS_U1_A]: {beer: 3},
          [TS_U1_B]: {wine: {count: 2, volume_ml: 400, abv: 0.06}},
        },
      },
    },
    u2: {
      s2: {
        start_time: TS_U2_A,
        timezone: 'Africa/Abidjan',
        drinks: {
          [TS_U2_A]: {cocktail: 1},
        },
      },
    },
  };
}

describe('useDrinkEvents', () => {
  let runAfterSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setAuth('u1');
    setContexts();
    setOnyx(makeSessions(), 'loaded');
    // Run the deferred buildDrinkEvents synchronously by default so existing
    // assertions can read the post-compute state without async waits. Tests
    // that exercise the loading → loaded transition override this locally.
    runAfterSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((cb: unknown) => {
        (cb as () => void)();
        return {cancel: jest.fn(), then: () => {}} as never;
      });
  });

  afterEach(() => {
    runAfterSpy.mockRestore();
  });

  test('hydration: loading status surfaces as isLoading=true with empty events', () => {
    setOnyx(undefined, 'loading');

    const {result} = renderHook(() => useDrinkEvents());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.events).toEqual([]);
  });

  test('hydration: loaded status surfaces as isLoading=false', () => {
    setOnyx(makeSessions(), 'loaded');

    const {result} = renderHook(() => useDrinkEvents());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.events.length).toBeGreaterThan(0);
  });

  test('defaults to current user when userIds is omitted', () => {
    setAuth('u1');

    const {result} = renderHook(() => useDrinkEvents());

    const userIds = new Set(result.current.events.map(e => e.userId));
    expect(userIds).toEqual(new Set(['u1']));
  });

  test('explicit single userId returns only that user', () => {
    const {result} = renderHook(() => useDrinkEvents(['u2']));

    const userIds = new Set(result.current.events.map(e => e.userId));
    expect(userIds).toEqual(new Set(['u2']));
  });

  test('multi-user pass-through returns events from all requested users', () => {
    const {result} = renderHook(() => useDrinkEvents(['u1', 'u2']));

    const userIds = new Set(result.current.events.map(e => e.userId));
    expect(userIds).toEqual(new Set(['u1', 'u2']));
  });

  test('empty userIds array returns no events', () => {
    const {result} = renderHook(() => useDrinkEvents([]));

    expect(result.current.events).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  test('no current user with omitted userIds returns no events', () => {
    setAuth(undefined);

    const {result} = renderHook(() => useDrinkEvents());

    expect(result.current.events).toEqual([]);
  });

  test('legacy numeric and v2-A object entries both materialise', () => {
    const {result} = renderHook(() => useDrinkEvents(['u1']));

    const beer = result.current.events.find(e => e.drinkKey === 'beer');
    const wine = result.current.events.find(e => e.drinkKey === 'wine');

    expect(beer).toBeDefined();
    expect(beer?.count).toBe(3);
    expect(beer?.units).toBe(3);
    expect(beer?.sdu).toBeDefined();

    expect(wine).toBeDefined();
    expect(wine?.count).toBe(2);
    expect(wine?.units).toBe(2);
    expect(wine?.sdu).toBeDefined();
  });

  test('events are stable in content across renders with unchanged inputs', () => {
    const sessions = makeSessions();
    setOnyx(sessions, 'loaded');

    const {result, rerender} = renderHook(() => useDrinkEvents(['u1']));
    const firstEvents = result.current.events;

    rerender(undefined);

    expect(result.current.events).toEqual(firstEvents);
  });

  test('missing timezone falls back to default without crashing', () => {
    setContexts(makePreferences(), {
      timezone: undefined,
    } as unknown as UserData);

    const {result} = renderHook(() => useDrinkEvents(['u1']));

    expect(result.current.events.length).toBeGreaterThan(0);
  });

  test('missing preferences still produces events (units default to 0)', () => {
    mockedUseDatabaseData.mockReturnValue({
      preferences: undefined,
      isFetchingOlderMonths: false,
    });
    mockedUseCurrentUserData.mockReturnValue(makeUserData());

    const {result} = renderHook(() => useDrinkEvents(['u1']));

    expect(result.current.events.length).toBeGreaterThan(0);
    expect(result.current.events.every(e => e.units === 0)).toBe(true);
  });

  test('defers buildDrinkEvents past the interaction frame', () => {
    // Capture the runAfterInteractions callback without invoking it so we can
    // observe the pre-compute loading state.
    let pending: (() => void) | null = null;
    runAfterSpy.mockImplementation((cb: unknown) => {
      pending = cb as () => void;
      return {cancel: jest.fn(), then: () => {}} as never;
    });

    const {result} = renderHook(() => useDrinkEvents(['u1']));

    // Pre-callback: hydration is "loaded" but deferred compute hasn't fired.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.events).toEqual([]);

    // Flush the deferred callback — events appear, isLoading drops.
    act(() => {
      pending?.();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.events.length).toBeGreaterThan(0);
  });

  test('cancels deferred work on unmount mid-flight', () => {
    const cancel = jest.fn();
    runAfterSpy.mockImplementation(
      () => ({cancel, then: () => {}}) as never,
    );

    const {unmount} = renderHook(() => useDrinkEvents(['u1']));
    unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
