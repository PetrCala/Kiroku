/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {renderHook} from '@testing-library/react-native';
import {addMonths, endOfMonth, startOfMonth, subMonths} from 'date-fns';
import type {DateData} from 'react-native-calendars';
import useHomeMonthStats from '@components/Home/useHomeMonthStats';
import {dateToDateData} from '@libs/DataHandling';
import type {DrinkingSession, Preferences} from '@src/types/onyx';

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

function makeSession(id: string, when: Date): DrinkingSession {
  return {
    id,
    start_time: when.getTime(),
    end_time: when.getTime(),
    blackout: false,
    note: '',
    type: 'edit',
    timezone: 'UTC',
    drinks: {[when.getTime()]: {beer: 1}},
  } as unknown as DrinkingSession;
}

function visibleDateOf(d: Date): DateData {
  return dateToDateData(d);
}

describe('useHomeMonthStats — alcohol-free days clamping', () => {
  // Pin "today" via a Date spy. Fake timers conflict with
  // @testing-library/react-native's act() cleanup (which depends on real
  // microtask scheduling), so we mock the system clock directly instead.
  const FIXED_NOW = new Date('2026-05-15T12:00:00Z');
  const RealDate = global.Date;
  let currentNow = FIXED_NOW.getTime();

  function setNow(d: Date) {
    currentNow = d.getTime();
  }

  beforeAll(() => {
    function MockDate(
      this: Date,
      arg1?: number | string | Date,
      ...rest: number[]
    ): Date {
      if (arg1 === undefined) {
        return new RealDate(currentNow);
      }
      if (rest.length === 0) {
        return new RealDate(arg1);
      }
      const [m = 0, d = 1, h = 0, mi = 0, s = 0, ms = 0] = rest;
      return new RealDate(arg1 as number, m, d, h, mi, s, ms);
    }
    MockDate.now = () => currentNow;
    MockDate.parse = RealDate.parse;
    MockDate.UTC = RealDate.UTC;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as unknown as {Date: any}).Date = MockDate;
  });

  afterAll(() => {
    (globalThis as unknown as {Date: typeof RealDate}).Date = RealDate;
  });

  beforeEach(() => {
    setNow(FIXED_NOW);
  });

  test('mid-month with sessions: only elapsed days count', () => {
    // May 1, May 3, May 10 — 3 drink days, today is May 15 (day 15 of 31).
    const sessions = {
      a: makeSession('a', new Date('2026-05-01T12:00:00Z')),
      b: makeSession('b', new Date('2026-05-03T12:00:00Z')),
      c: makeSession('c', new Date('2026-05-10T12:00:00Z')),
    };
    const {result} = renderHook(() =>
      useHomeMonthStats(visibleDateOf(FIXED_NOW), sessions, makePreferences()),
    );
    // Elapsed days = 15. Drink days = 3. Alcohol-free = 12.
    expect(result.current.alcoholFreeDays).toBe(12);
    expect(result.current.drinkingSessionsCount).toBe(3);
  });

  test('first-of-month, no sessions: alcohol-free = 1 (today only)', () => {
    const firstOfMonth = new Date('2026-05-01T08:00:00Z');
    setNow(firstOfMonth);
    const {result} = renderHook(() =>
      useHomeMonthStats(visibleDateOf(firstOfMonth), {}, makePreferences()),
    );
    // Without sessions on day 1, alcohol-free = 1 (only May 1 elapsed).
    // It must NOT equal daysInMonth (31).
    expect(result.current.alcoholFreeDays).toBe(1);
    setNow(FIXED_NOW);
  });

  test('past month: full month counts', () => {
    // April 2026 — 30 days, fully past. Two drink days.
    const aprilDate = subMonths(FIXED_NOW, 1);
    const sessions = {
      a: makeSession('a', new Date('2026-04-05T12:00:00Z')),
      b: makeSession('b', new Date('2026-04-20T12:00:00Z')),
    };
    const {result} = renderHook(() =>
      useHomeMonthStats(visibleDateOf(aprilDate), sessions, makePreferences()),
    );
    expect(result.current.alcoholFreeDays).toBe(30 - 2);
  });

  test('future month: alcohol-free days = 0 (no time has elapsed)', () => {
    const juneDate = addMonths(FIXED_NOW, 1);
    const {result} = renderHook(() =>
      useHomeMonthStats(visibleDateOf(juneDate), {}, makePreferences()),
    );
    expect(result.current.alcoholFreeDays).toBe(0);
  });

  test('end of past month: clamping does not eat days', () => {
    // Look at March 31 — we are in May, so March is fully past.
    const marchEnd = endOfMonth(subMonths(FIXED_NOW, 2));
    const {result} = renderHook(() =>
      useHomeMonthStats(visibleDateOf(marchEnd), {}, makePreferences()),
    );
    // March = 31 days, zero sessions.
    expect(result.current.alcoholFreeDays).toBe(31);
  });

  test('returns zero stats with undefined preferences', () => {
    const {result} = renderHook(() =>
      useHomeMonthStats(visibleDateOf(FIXED_NOW), {}, undefined),
    );
    expect(result.current.alcoholFreeDays).toBe(0);
    expect(result.current.drinkingSessionsCount).toBe(0);
    expect(result.current.unitsConsumed).toBe(0);
  });

  test('start-of-month with today on day 1 (consistency with first-of-month test)', () => {
    // Sanity: today on May 1 with no sessions == 1 alcohol-free day, not 31.
    const may1 = startOfMonth(FIXED_NOW);
    setNow(may1);
    const {result} = renderHook(() =>
      useHomeMonthStats(visibleDateOf(may1), {}, makePreferences()),
    );
    expect(result.current.alcoholFreeDays).toBe(1);
    setNow(FIXED_NOW);
  });
});
