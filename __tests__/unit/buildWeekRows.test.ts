/**
 * @jest-environment node
 */

import buildWeekRows from '@components/SessionsCalendar/buildWeekRows';

describe('SessionsCalendar/buildWeekRows', () => {
  // CONST.WEEK_STARTS_ON is 1 (Monday) — these tests assume that default
  // unless they override `weekStartsOn` explicitly.

  it('returns an empty array when start is after end', () => {
    const rows = buildWeekRows({
      start: new Date(2026, 1, 1),
      end: new Date(2026, 0, 31),
    });
    expect(rows).toEqual([]);
  });

  it('builds a single row when start and end land in the same week', () => {
    // 2026-05-19 (Tue) → 2026-05-20 (Wed). Both fall in the week starting
    // Mon 2026-05-18.
    const rows = buildWeekRows({
      start: new Date(2026, 4, 19),
      end: new Date(2026, 4, 20),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].weekStart).toBe('2026-05-18');
    expect(rows[0].days).toEqual([
      null, // Mon — before start
      '2026-05-19',
      '2026-05-20',
      null, // Thu — after end
      null,
      null,
      null,
    ]);
    expect(rows[0].isFirstWeekOfMonth).toBe(false);
  });

  it('marks the first week of a month and exposes month/year', () => {
    // 2026-04-26 → 2026-05-10 spans the boundary into May.
    const rows = buildWeekRows({
      start: new Date(2026, 3, 26),
      end: new Date(2026, 4, 10),
    });
    // The week containing 2026-05-01 (Fri) should be flagged.
    const mayFirstWeek = rows.find(r => r.isFirstWeekOfMonth);
    expect(mayFirstWeek).toBeDefined();
    expect(mayFirstWeek?.monthOfFirstDay).toBe(4); // May
    expect(mayFirstWeek?.yearOfFirstDay).toBe(2026);
    // Days outside [start, end] (e.g. before April 26 or after May 10) are
    // null in their respective rows.
    expect(rows[0].days[0]).toBeNull(); // Mon Apr 20 — before start
  });

  it('handles year boundaries', () => {
    // Dec 2025 → Jan 2026
    const rows = buildWeekRows({
      start: new Date(2025, 11, 28),
      end: new Date(2026, 0, 5),
    });
    const janFirstWeek = rows.find(
      r => r.monthOfFirstDay === 0 && r.yearOfFirstDay === 2026,
    );
    expect(janFirstWeek).toBeDefined();
  });

  it('respects a custom weekStartsOn', () => {
    // Same range as the single-row test, but week starts on Sunday (0).
    // 2026-05-19 (Tue) → 2026-05-20 (Wed). Week starts Sun 2026-05-17.
    const rows = buildWeekRows({
      start: new Date(2026, 4, 19),
      end: new Date(2026, 4, 20),
      weekStartsOn: 0,
    });
    expect(rows[0].weekStart).toBe('2026-05-17');
    expect(rows[0].days[0]).toBeNull(); // Sun 17 — before start
    expect(rows[0].days[2]).toBe('2026-05-19'); // Tue
    expect(rows[0].days[3]).toBe('2026-05-20'); // Wed
  });

  it('produces rows in chronological order', () => {
    const rows = buildWeekRows({
      start: new Date(2026, 0, 1),
      end: new Date(2026, 2, 31),
    });
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].weekStart > rows[i - 1].weekStart).toBe(true);
    }
  });
});
