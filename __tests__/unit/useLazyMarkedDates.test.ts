/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {act, renderHook} from '@testing-library/react-native';
import {addMonths, differenceInMonths, startOfMonth, subMonths} from 'date-fns';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import {getCompactCalendarLoadTarget} from '@libs/SessionsCalendarUtils';
import * as Calendar from '@userActions/Calendar';
import type {
  DrinkingSession,
  DrinkingSessionList,
  Preferences,
} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type * as OnyxModule from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

jest.mock('@hooks/useResolvedPalette', () => {
  // A single stable palette object: the hook keys its month-derivation cache
  // on the `{...preferences, session_color_palette: palette}` identity, so a
  // fresh palette per render would defeat the cache the identity tests below
  // assert on (the real hook returns a stable resolved palette too).
  const stablePalette = {
    green: '#00ff00',
    yellow: '#ffff00',
    orange: '#ff8800',
    red: '#ff0000',
    black: '#000000',
  };
  return {
    __esModule: true,
    default: jest.fn(() => stablePalette),
  };
});

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
  jest.clearAllMocks();
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

describe('useLazyMarkedDates compact paging covers the visible month (Rule 1)', () => {
  const pad = (n: number) => String(n).padStart(2, '0');

  test('paging back to an older month makes its data present without a second move', () => {
    // A friend (no canonical floor) with a single session 5 months back, built
    // at noon UTC so the zoned day key is timezone-stable. Fresh, the derived
    // window is only the current month — the older month's data is NOT on
    // screen yet, which is exactly the "blank until you move again" state Rule 1
    // forbids when you page to it.
    const targetStart = startOfMonth(subMonths(new Date(), 5));
    const targetYear = targetStart.getFullYear();
    const targetMonth = targetStart.getMonth(); // 0-based
    const sessionInstant = Date.UTC(targetYear, targetMonth, 15, 12, 0, 0);
    const targetMonthKey = `${targetYear}-${pad(targetMonth + 1)}`;
    const sessionDayKey = `${targetMonthKey}-15` as DateString;
    const sessions = {
      s1: {
        id: 's1',
        start_time: sessionInstant,
        timezone: 'UTC',
        drinks: {[sessionInstant]: {beer: 1}},
      },
    } as unknown as DrinkingSessionList;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, makePreferences()),
    );

    // Precondition: the older month is outside the initial derived window, so
    // its session is not yet rendered.
    expect(
      result.current.calendarMonths.some(
        month => month.monthKey === targetMonthKey,
      ),
    ).toBe(false);
    expect(result.current.markedDates[sessionDayKey]).toBeUndefined();

    // Page back to that month: the compact handler drives `loadUpTo` with the
    // look-ahead load target for the month about to become visible.
    act(() => {
      result.current.loadUpTo(getCompactCalendarLoadTarget(targetStart, 3));
    });

    // The loaded floor now covers the visible month (at or below its start) and
    // its data is on screen — no further in-calendar navigation needed.
    expect(getLoadedFrom(result).getTime()).toBeLessThanOrEqual(
      targetStart.getTime(),
    );
    expect(
      result.current.calendarMonths.some(
        month => month.monthKey === targetMonthKey,
      ),
    ).toBe(true);
    expect(result.current.markedDates[sessionDayKey]).toBeDefined();
    expect(result.current.unitsMap.get(sessionDayKey)).toBe(1);
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

describe('useLazyMarkedDates incremental derivation', () => {
  test('widening keeps previously derived month objects referentially identical', () => {
    // Stable inputs across re-renders — the per-month cache is keyed on the
    // session-group and effective-preferences identities.
    const prefs = makePreferences();
    const windowEdge = subMonths(new Date(), 12);
    const sessions = {
      s1: {start_time: windowEdge.getTime(), timezone: 'UTC', drinks: {}},
    } as unknown as DrinkingSessionList;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, prefs),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 12));
    });
    const before = new Map(
      result.current.calendarMonths.map(month => [month.monthKey, month]),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 24));
    });
    const after = result.current.calendarMonths;

    // The widen appended older months…
    expect(after.length).toBeGreaterThan(before.size);
    // …and every month that was already derived kept its identity, so the
    // week-list's memoized rows for those months never re-render.
    let overlapCount = 0;
    after.forEach(month => {
      const previous = before.get(month.monthKey);
      if (!previous) {
        return;
      }
      overlapCount += 1;
      expect(month).toBe(previous);
    });
    expect(overlapCount).toBe(before.size);
  });

  test('a live-drink overlay re-derives only the overlay month', () => {
    const prefs = makePreferences();
    const today = new Date();
    const previousMonth = subMonths(today, 1);
    const sessions = {
      old: {
        id: 'old',
        start_time: previousMonth.getTime(),
        timezone: 'UTC',
        drinks: {[previousMonth.getTime()]: {beer: 1}},
      },
    } as unknown as DrinkingSessionList;

    const initialProps: {overlay?: DrinkingSession} = {overlay: undefined};
    const {result, rerender} = renderHook(
      ({overlay}: {overlay?: DrinkingSession}) =>
        useLazyMarkedDates(TEST_UID, sessions, prefs, overlay),
      {initialProps},
    );

    act(() => {
      result.current.loadUpTo(previousMonth);
    });
    const before = new Map(
      result.current.calendarMonths.map(month => [month.monthKey, month]),
    );

    const overlay = {
      id: 'live-1',
      ongoing: true,
      start_time: today.getTime(),
      timezone: 'UTC',
      drinks: {[today.getTime()]: {beer: 2}},
    } as unknown as DrinkingSession;
    rerender({overlay});

    const pad = (n: number) => String(n).padStart(2, '0');
    const currentMonthKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

    result.current.calendarMonths.forEach(month => {
      const previous = before.get(month.monthKey);
      if (!previous) {
        return;
      }
      if (month.monthKey === currentMonthKey) {
        // The overlay's month is a patched clone carrying the live units.
        expect(month).not.toBe(previous);
        expect(month.totalUnits).toBe(2);
      } else {
        // Every other month keeps identity — a drink tap repaints one month.
        expect(month).toBe(previous);
      }
    });
  });

  test('deriveFullRangeToFloor derives to the canonical floor without writing the depth lever', () => {
    jest.useFakeTimers();
    try {
      const earliest = subMonths(new Date(), 10);
      mockUserDataList = {
        [TEST_UID]: {earliest_session_at: earliest.getTime()},
      };
      const prefs = makePreferences();
      const sessions = {
        s1: {start_time: earliest.getTime(), timezone: 'UTC', drinks: {}},
      } as unknown as DrinkingSessionList;

      const {result} = renderHook(() =>
        useLazyMarkedDates(TEST_UID, sessions, prefs, undefined, {
          deriveFullRangeToFloor: true,
        }),
      );

      // The whole tracked range is derived up front (no loadUpTo needed):
      // months from the earliest tracked month through the current one.
      expect(result.current.calendarMonths.length).toBe(11);
      expect(getLoadedFrom(result).getTime()).toBe(
        startOfMonth(earliest).getTime(),
      );

      // …and the persisted depth lever was never touched (the full-range
      // derivation must not pollute the compact calendar's / Statistics'
      // shared depth).
      jest.advanceTimersByTime(1000);
      expect(
        Calendar.setSessionsCalendarMonthsLoadedForUser,
      ).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('deriveFullRangeToFloor is a no-op without a canonical floor (friend)', () => {
    const prefs = makePreferences();
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, prefs, undefined, {
        deriveFullRangeToFloor: true,
      }),
    );
    // No floor to derive to — only the current month, as without the option.
    expect(result.current.calendarMonths.length).toBe(1);
  });

  test('merged outputs keep their contracts (green sober days, units, sparse month totals)', () => {
    const prefs = makePreferences();
    const today = new Date();
    const sessions = {
      s1: {
        id: 's1',
        start_time: today.getTime(),
        timezone: 'UTC',
        drinks: {[today.getTime()]: {beer: 1}},
      },
    } as unknown as DrinkingSessionList;

    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, sessions, prefs),
    );

    act(() => {
      // Widen one month so a guaranteed sober day (the 1st of the previous
      // month) is in range regardless of today's date.
      result.current.loadUpTo(subMonths(new Date(), 1));
    });

    const pad = (n: number) => String(n).padStart(2, '0');
    const todayKey =
      `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}` as DateString;
    const monthKey = todayKey.slice(0, 7);
    const previousMonth = subMonths(today, 1);
    const soberKey =
      `${previousMonth.getFullYear()}-${pad(previousMonth.getMonth() + 1)}-01` as DateString;

    // Session day: marked, in unitsMap, in the (sparse) month totals.
    expect(result.current.markedDates[todayKey]).toBeDefined();
    expect(result.current.unitsMap.get(todayKey)).toBe(1);
    expect(result.current.monthlyTotalsMap.get(monthKey)).toBe(1);
    // Sober in-range day: green marking, no units entry, no month-total entry.
    expect(result.current.markedDates[soberKey]).toEqual({color: '#00ff00'});
    expect(result.current.unitsMap.has(soberKey)).toBe(false);
    expect(result.current.monthlyTotalsMap.has(soberKey.slice(0, 7))).toBe(
      false,
    );
  });
});
