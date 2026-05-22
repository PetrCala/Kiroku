/**
 * @jest-environment node
 */

import buildMonthSections from '@components/SessionsCalendar/buildMonthSections';
import type {DateString} from '@src/types/onyx/OnyxCommon';

const d = (s: string) => s as DateString;

describe('SessionsCalendar/buildMonthSections', () => {
  // CONST.WEEK_STARTS_ON is 1 (Monday) — unless overridden with weekStartsOn.

  it('returns an empty array when start is after end', () => {
    const sections = buildMonthSections({
      start: new Date(2026, 1, 1),
      end: new Date(2026, 0, 31),
    });
    expect(sections).toEqual([]);
  });

  it('builds one self-contained section for a single full month', () => {
    // May 2026 — May 1 is Fri, May 31 is Sun. With Monday weekStart, May
    // fits in 5 week rows: row 1 has Mon-Thu blank then Fri-Sun = 1-3;
    // row 5 fills cleanly Mon-Sun = 25-31.
    const sections = buildMonthSections({
      start: new Date(2026, 4, 1),
      end: new Date(2026, 4, 31),
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({year: 2026, month: 4});
    const weeks = sections[0].weeks;
    expect(weeks).toHaveLength(5);

    // First week: Mon Apr 27 (blank, out of month) … Fri May 1 = '2026-05-01'.
    expect(weeks[0].days).toEqual([
      null,
      null,
      null,
      null,
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);

    // Last week: Mon May 25 = '2026-05-25' … Sun May 31 = '2026-05-31'.
    expect(weeks[4].days).toEqual([
      '2026-05-25',
      '2026-05-26',
      '2026-05-27',
      '2026-05-28',
      '2026-05-29',
      '2026-05-30',
      '2026-05-31',
    ]);
  });

  it('produces trailing blanks when the month does not fill its last week', () => {
    // Feb 2026 — Feb 1 is Sun, Feb 28 is Sat. With Monday weekStart, the
    // last week (Mon Feb 23 – Sun Mar 1) has the Sun cell blank because
    // Mar 1 is outside the February section.
    const sections = buildMonthSections({
      start: new Date(2026, 1, 1),
      end: new Date(2026, 1, 28),
    });
    const feb = sections[0];
    const last = feb.weeks[feb.weeks.length - 1];
    expect(last.days[0]).toBe('2026-02-23');
    expect(last.days[5]).toBe('2026-02-28');
    expect(last.days[6]).toBeNull();
  });

  it('keeps each section self-contained (no bleed across boundaries)', () => {
    // Mar 28 → May 5 spans Mar, Apr, May. Each section should only
    // contain its own days; e.g. Mar 30 lives in March, never in April.
    const sections = buildMonthSections({
      start: new Date(2026, 2, 28),
      end: new Date(2026, 4, 5),
    });
    expect(sections.map(s => s.month)).toEqual([2, 3, 4]);

    const march = sections[0];
    const april = sections[1];

    // Mar 30 / Mar 31 must only appear in March, never in April.
    const aprilHasMar = april.weeks.some(w =>
      w.days.some(day => day?.startsWith('2026-03-')),
    );
    expect(aprilHasMar).toBe(false);

    // Mar 30 should appear in March.
    const marchHasMar30 = march.weeks.some(w =>
      w.days.includes(d('2026-03-30')),
    );
    expect(marchHasMar30).toBe(true);

    // April's first row should have leading blanks where March's tail
    // would have been, then Apr 1 (Wed).
    expect(april.weeks[0].days[0]).toBeNull();
    expect(april.weeks[0].days[2]).toBe('2026-04-01');
  });

  it('respects the loaded-range boundaries with blanks at the edges', () => {
    // Start mid-March; March's days before the start should be blank.
    const sections = buildMonthSections({
      start: new Date(2026, 2, 10),
      end: new Date(2026, 2, 31),
    });
    const march = sections[0];
    expect(march.month).toBe(2);
    // Mar 9 is a Mon, which would be in March but before the loaded range
    // — must be null.
    const mar9 = march.weeks
      .flatMap(w => w.days)
      .find(day => day === d('2026-03-09'));
    expect(mar9).toBeUndefined();
    const mar10 = march.weeks
      .flatMap(w => w.days)
      .find(day => day === d('2026-03-10'));
    expect(mar10).toBe('2026-03-10');
  });

  it('handles year boundaries', () => {
    const sections = buildMonthSections({
      start: new Date(2025, 11, 28),
      end: new Date(2026, 0, 5),
    });
    expect(sections.map(s => `${s.year}-${s.month}`)).toEqual([
      '2025-11',
      '2026-0',
    ]);
  });

  it('respects a custom weekStartsOn', () => {
    // May 2026 with Sunday weekStart.
    const sections = buildMonthSections({
      start: new Date(2026, 4, 1),
      end: new Date(2026, 4, 31),
      weekStartsOn: 0,
    });
    const may = sections[0];
    // First week: Sun Apr 26 (null) … Fri May 1.
    expect(may.weeks[0].days[5]).toBe('2026-05-01');
  });

  it('produces sections in chronological order', () => {
    const sections = buildMonthSections({
      start: new Date(2026, 0, 1),
      end: new Date(2026, 5, 30),
    });
    for (let i = 1; i < sections.length; i++) {
      const prev = sections[i - 1];
      const next = sections[i];
      const prevKey = prev.year * 12 + prev.month;
      const nextKey = next.year * 12 + next.month;
      expect(nextKey).toBeGreaterThan(prevKey);
    }
  });
});
