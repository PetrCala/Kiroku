/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {act, renderHook} from '@testing-library/react-native';
import {addMonths, differenceInMonths, subMonths} from 'date-fns';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import type {
  DrinkingSession,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';

jest.mock('@hooks/useResolvedPalette', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    green: '#00ff00',
    yellow: '#ffff00',
    orange: '#ff8800',
    red: '#ff0000',
    black: '#000000',
  })),
}));

jest.mock('@userActions/Calendar', () => ({
  __esModule: true,
  setSessionsCalendarMonthsLoadedForUser: jest.fn(),
}));

const TEST_UID = 'user-123';

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

function getLoadedFrom(result: {
  current: ReturnType<typeof useLazyMarkedDates>;
}): Date {
  const loadedFrom = result.current.loadedFrom.current;
  if (!loadedFrom) {
    throw new Error('expected loadedFrom.current to be set after render');
  }
  return loadedFrom;
}

describe('useLazyMarkedDates.loadUpTo', () => {
  test('extends loadedMonths to cover the target', () => {
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences()),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 5));
    });

    const loadedFrom = getLoadedFrom(result);
    expect(differenceInMonths(new Date(), loadedFrom)).toBeGreaterThanOrEqual(
      5,
    );
  });

  test('shallower target is a no-op (depth never decreases)', () => {
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences()),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 5));
    });
    const after5 = getLoadedFrom(result);
    const depthAfter5 = differenceInMonths(new Date(), after5);

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 3));
    });
    const after3 = getLoadedFrom(result);

    // React bails on equal setState, so the ref points at the same Date object.
    expect(after3).toBe(after5);
    expect(differenceInMonths(new Date(), after3)).toBe(depthAfter5);
  });

  test('future target is a no-op', () => {
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences()),
    );

    const initial = getLoadedFrom(result);

    act(() => {
      result.current.loadUpTo(addMonths(new Date(), 3));
    });

    expect(result.current.loadedFrom.current).toBe(initial);
  });
});

describe('useLazyMarkedDates earliest-month cap', () => {
  test('clamps the loaded window to the earliest tracked month, ignoring an inflated depth', () => {
    // One session ~10 months ago is the user's entire history.
    const earliest = subMonths(new Date(), 10);
    const sessions = {
      s1: {start_time: earliest.getTime(), timezone: 'UTC', drinks: {}},
    } as unknown as DrinkingSessionList;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, makePreferences()),
    );

    act(() => {
      // Stats-style overshoot: a comparison/All range can push the shared
      // depth lever far deeper than any data ever reaches.
      result.current.loadUpTo(subMonths(new Date(), 60));
    });

    // The build floor is clamped to the earliest session's month (~10 months
    // back), not the requested 60 — so the day-key build never spans empty
    // pre-tracking months.
    const depth = differenceInMonths(new Date(), getLoadedFrom(result));
    expect(depth).toBeGreaterThanOrEqual(9);
    expect(depth).toBeLessThanOrEqual(11);
  });
});

describe('useLazyMarkedDates ongoing overlay', () => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayKeyFor = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as DateString;

  test('overlays the live session, replacing the stale cached entry for its day', () => {
    const today = new Date();
    const ts = today.getTime();
    // The cached snapshot holds a finished session (1 unit) plus the stale
    // ongoing session seeded at start (0 drinks).
    const sessions = {
      done: {
        id: 'done',
        type: 'edit',
        start_time: ts,
        timezone: 'UTC',
        drinks: {[ts]: {beer: 1}},
      },
      'live-1': {
        id: 'live-1',
        type: 'live',
        ongoing: true,
        start_time: ts,
        timezone: 'UTC',
        drinks: {},
      },
    } as unknown as DrinkingSessionList;
    // The live buffer carries the real in-progress drinks (2 units).
    const overlay = {
      id: 'live-1',
      type: 'live',
      ongoing: true,
      start_time: ts,
      timezone: 'UTC',
      drinks: {[ts]: {beer: 2}},
    } as unknown as DrinkingSession;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, makePreferences(), overlay),
    );

    const dayKey = dayKeyFor(today);
    const monthKey = dayKey.slice(0, 7);

    // 1 (finished) + 2 (live) = 3 units on the day and in the month total.
    expect(result.current.unitsMap.get(dayKey)).toBe(3);
    expect(result.current.monthlyTotalsMap.get(monthKey)).toBe(3);
    expect(result.current.markedDates[dayKey]).toBeDefined();

    const entries = result.current.sessionEntriesByDay.get(dayKey) ?? [];
    expect(entries).toHaveLength(2);
    const liveEntry = entries.find(entry => entry.sessionId === 'live-1');
    expect(liveEntry?.session.drinks).toEqual({[ts]: {beer: 2}});
  });

  test('does not inject a live session when no overlay is provided', () => {
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences(), undefined),
    );
    expect(result.current.unitsMap.size).toBe(0);
    expect(result.current.sessionEntriesByDay.size).toBe(0);
  });

  test('ignores an overlay that is not ongoing', () => {
    const today = new Date();
    const overlay = {
      id: 'live-1',
      ongoing: false,
      start_time: today.getTime(),
      timezone: 'UTC',
      drinks: {[today.getTime()]: {beer: 2}},
    } as unknown as DrinkingSession;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences(), overlay),
    );
    expect(result.current.unitsMap.size).toBe(0);
    expect(result.current.sessionEntriesByDay.size).toBe(0);
  });
});
