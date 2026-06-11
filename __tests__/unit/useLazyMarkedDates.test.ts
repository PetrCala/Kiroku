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
import type * as OnyxModule from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

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

// Drive `USER_DATA_LIST` per test so we can exercise both the self path (a
// canonical `earliest_session_at` floor) and the friend path (no such floor).
// Everything else keeps the real Onyx behaviour the existing tests rely on
// (the per-user months key resolves to `undefined`/`loaded`, and `loadUpTo`
// updates the hook's local `loadedMonths` state). Mock-prefixed so the
// `jest.mock` factory may reference it (jest hoists the factory above imports).
let mockUserDataList:
  | Record<string, {earliest_session_at?: number}>
  | undefined;
const mockUserDataKey = ONYXKEYS.USER_DATA_LIST;
jest.mock('react-native-onyx', () => {
  const actual = jest.requireActual<typeof OnyxModule>('react-native-onyx');
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useOnyx: (key: string) => {
      if (key === mockUserDataKey) {
        return [mockUserDataList, {status: 'loaded'}];
      }
      return [undefined, {status: 'loaded'}];
    },
  };
});

const TEST_UID = 'user-123';

beforeEach(() => {
  // Default: friend profile (no canonical floor). Self-path tests opt in.
  mockUserDataList = undefined;
});

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
  test('clamps the loaded window to the canonical earliest tracked month, ignoring an inflated depth', () => {
    // Self profile: a canonical `earliest_session_at` floor ~10 months back is
    // what gates the cap (the windowed session list no longer does).
    const earliest = subMonths(new Date(), 10);
    mockUserDataList = {[TEST_UID]: {earliest_session_at: earliest.getTime()}};
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

describe('useLazyMarkedDates friend window (no canonical floor) — Kiroku #1197', () => {
  // A friend's `sessions` is the server-windowed slice and `earliest_session_at`
  // is never present, so the floor must NOT be derived from the loaded slice or
  // scroll-back freezes at the 12-month prefetch edge. These assert the
  // window-exhaustion signal that replaces the windowed hard floor.

  test('hasPersistedFloor is false and the window is NOT exhausted while the slice still hugs its lower edge', () => {
    // Friend history predates the loaded window: the earliest LOADED session
    // sits right at the fetch floor month (12 months back), so older months may
    // still exist — widening must stay allowed.
    const windowEdge = subMonths(new Date(), 12);
    const sessions = {
      s1: {start_time: windowEdge.getTime(), timezone: 'UTC', drinks: {}},
    } as unknown as DrinkingSessionList;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, makePreferences()),
    );

    act(() => {
      // The fullscreen prefetch lands the window at 12 months back.
      result.current.loadUpTo(subMonths(new Date(), 12));
    });

    expect(result.current.hasPersistedFloor).toBe(false);
    // The earliest loaded session is IN the fetch floor month, so the slice may
    // be clipping older sessions — not exhausted. This is the off-by-one that
    // used to freeze the friend calendar at the month-start boundary: the
    // earliest-loaded month must compare equal to the fetch floor month, not a
    // month later (which `startOfMonth(loadedFromDate)` — a `startOfMonth − 1
    // day` — would have produced).
    expect(result.current.isWindowExhausted).toBe(false);
  });

  test('window IS exhausted once the earliest loaded session sits above the fetch floor', () => {
    // Friend whose entire history is recent (one session ~2 months back). Even
    // at the default 12-month window the server returned everything, and the
    // earliest session sits well above the floor → nothing older to fetch.
    const recent = subMonths(new Date(), 2);
    const sessions = {
      s1: {start_time: recent.getTime(), timezone: 'UTC', drinks: {}},
    } as unknown as DrinkingSessionList;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, makePreferences()),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 12));
    });

    expect(result.current.hasPersistedFloor).toBe(false);
    expect(result.current.isWindowExhausted).toBe(true);
  });

  test('empty / privacy-denied friend read is exhausted (no infinite widen loop)', () => {
    // An empty slice (denied / evicted #786 read) has nothing to widen into.
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences()),
    );

    expect(result.current.hasPersistedFloor).toBe(false);
    expect(result.current.isWindowExhausted).toBe(true);
  });

  test('widening deepens the build floor for a friend (no windowed-floor cap)', () => {
    // Friend history older than the window. With the windowed-floor cap removed,
    // a deeper `loadUpTo` must actually deepen the build floor (the old cap
    // clamped it to the earliest loaded session and froze scroll-back).
    const windowEdge = subMonths(new Date(), 12);
    const sessions = {
      s1: {start_time: windowEdge.getTime(), timezone: 'UTC', drinks: {}},
    } as unknown as DrinkingSessionList;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, makePreferences()),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 24));
    });

    // The build floor follows the requested depth (~24 months), not the
    // earliest loaded session's month (~12).
    const depth = differenceInMonths(new Date(), getLoadedFrom(result));
    expect(depth).toBeGreaterThanOrEqual(23);
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
