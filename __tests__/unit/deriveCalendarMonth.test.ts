import {
  deriveCalendarMonth,
  getDerivedCalendarMonth,
  groupSessionsByMonth,
} from '@components/SessionsCalendar/deriveCalendarMonth';
import type {DrinkingSessionList, Preferences} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';

const GREEN = '#00ff00';

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
    session_color_palette: {
      green: GREEN,
      yellow: '#ffff00',
      orange: '#ff8800',
      red: '#ff0000',
      black: '#000000',
    },
    theme: 'system',
  } as unknown as Preferences;
}

/** One-session day map for a fixed day, shaped like `groupSessionsByMonth`'s
 *  inner per-month value. */
function makeMonthEntries(
  dayKey: DateString,
  beerCount: number,
): Map<DateString, DrinkingSessionKeyValue[]> {
  const startTime = new Date(`${dayKey}T12:00:00Z`).getTime();
  const session = {
    id: 's1',
    start_time: startTime,
    timezone: 'UTC',
    drinks: {[startTime]: {beer: beerCount}},
  } as unknown as DrinkingSessionKeyValue['session'];
  return new Map([[dayKey, [{sessionId: 's1', session}]]]);
}

describe('deriveCalendarMonth', () => {
  test('derives markings, units, entries, and the month total for a whole month', () => {
    const month = deriveCalendarMonth({
      year: 2026,
      month: 2, // March
      monthEntriesByDay: makeMonthEntries('2026-03-10' as DateString, 2),
      effectivePreferences: makePreferences(),
      endClamp: null,
    });

    expect(month.monthKey).toBe('2026-03');
    // Every day of March carries cell data; sober days are green with no units.
    expect(month.dayData.size).toBe(31);
    expect(month.dayData.get('2026-03-01' as DateString)).toEqual({
      marking: {color: GREEN},
    });
    // The session day carries the session marking and its units.
    const sessionCell = month.dayData.get('2026-03-10' as DateString);
    expect(sessionCell?.units).toBe(2);
    expect(sessionCell?.marking.color).toBeDefined();
    // Only session days enter `entriesByDay`; the total sums the month.
    expect([...month.entriesByDay.keys()]).toEqual(['2026-03-10']);
    expect(month.totalUnits).toBe(2);
    // Whole-month grid: every week row has 7 cells.
    expect(month.weeks.length).toBeGreaterThanOrEqual(5);
    month.weeks.forEach(week => expect(week.days).toHaveLength(7));
  });

  test('clamps the current month at endClamp', () => {
    const month = deriveCalendarMonth({
      year: 2026,
      month: 2,
      monthEntriesByDay: undefined,
      effectivePreferences: makePreferences(),
      endClamp: new Date(2026, 2, 10),
    });

    // Days 1–10 only — nothing after the clamp is derived or rendered.
    expect(month.dayData.size).toBe(10);
    expect(month.dayData.has('2026-03-10' as DateString)).toBe(true);
    expect(month.dayData.has('2026-03-11' as DateString)).toBe(false);
  });
});

describe('groupSessionsByMonth', () => {
  test('groups by the zoned day, not the raw UTC timestamp', () => {
    // Both sessions share the same UTC instant near a month boundary; their
    // timezones pull them into different calendar months.
    const utcInstant = Date.UTC(2026, 1, 28, 23, 0); // Feb 28 2026, 23:00 UTC
    const sessions = {
      auckland: {
        start_time: utcInstant,
        timezone: 'Pacific/Auckland', // UTC+13 → already March 1 locally
        drinks: {},
      },
      newYork: {
        start_time: utcInstant,
        timezone: 'America/New_York', // UTC−5 → still Feb 28 locally
        drinks: {},
      },
    } as unknown as DrinkingSessionList;

    const groups = groupSessionsByMonth(sessions, 'UTC');

    expect(groups.get('2026-03')?.get('2026-03-01' as DateString)).toHaveLength(
      1,
    );
    expect(groups.get('2026-02')?.get('2026-02-28' as DateString)).toHaveLength(
      1,
    );
  });

  test('falls back to the default timezone when the session has none', () => {
    const utcInstant = Date.UTC(2026, 1, 28, 23, 0);
    const sessions = {
      s1: {start_time: utcInstant, drinks: {}},
    } as unknown as DrinkingSessionList;

    const groups = groupSessionsByMonth(sessions, 'Pacific/Auckland');
    expect(groups.has('2026-03')).toBe(true);
  });
});

describe('getDerivedCalendarMonth cache', () => {
  test('same inputs return the same object; changed inputs recompute', () => {
    const prefs = makePreferences();
    const entries = makeMonthEntries('2026-03-10' as DateString, 1);
    const baseArgs = {
      year: 2026,
      month: 2,
      monthEntriesByDay: entries,
      effectivePreferences: prefs,
      endClamp: null,
    };

    const first = getDerivedCalendarMonth(baseArgs);
    // Identical inputs (by identity) → cached object.
    expect(getDerivedCalendarMonth({...baseArgs})).toBe(first);

    // New session group (a session changed) → recompute.
    const changedEntries = makeMonthEntries('2026-03-10' as DateString, 1);
    expect(
      getDerivedCalendarMonth({...baseArgs, monthEntriesByDay: changedEntries}),
    ).not.toBe(first);

    // New preferences object (palette/threshold change) → recompute.
    expect(
      getDerivedCalendarMonth({
        ...baseArgs,
        effectivePreferences: makePreferences(),
      }),
    ).not.toBe(first);

    // Different endClamp day (today rolled over) → recompute.
    const clampedA = getDerivedCalendarMonth({
      ...baseArgs,
      endClamp: new Date(2026, 2, 10),
    });
    const clampedB = getDerivedCalendarMonth({
      ...baseArgs,
      endClamp: new Date(2026, 2, 11),
    });
    expect(clampedA).not.toBe(clampedB);
    // …but the same clamp day hits the cache again.
    expect(
      getDerivedCalendarMonth({...baseArgs, endClamp: new Date(2026, 2, 10)}),
    ).toBe(clampedA);
  });

  test('a month without sessions caches across calls with undefined groups', () => {
    const prefs = makePreferences();
    const args = {
      year: 2026,
      month: 0,
      monthEntriesByDay: undefined,
      effectivePreferences: prefs,
      endClamp: null,
    };
    expect(getDerivedCalendarMonth(args)).toBe(getDerivedCalendarMonth(args));
  });
});
