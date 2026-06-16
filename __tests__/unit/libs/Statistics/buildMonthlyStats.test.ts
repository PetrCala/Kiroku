import {buildMonthlyStats} from '@libs/Statistics/overview';
import type {DrinkEvent} from '@libs/Statistics/types';

const THRESHOLDS = {yellow: 5, orange: 10};

/** Local-time event so day keys and `dateRange(ts)` agree regardless of TZ. */
function event(
  localDay: string,
  units: number,
  overrides?: Partial<DrinkEvent>,
): DrinkEvent {
  const ts = overrides?.ts ?? new Date(`${localDay}T12:00:00`).getTime();
  return {
    userId: 'u1',
    sessionId: `s-${localDay}`,
    ts,
    anchorTs: ts,
    localDay,
    localIsoWeek: '2026-W01',
    localMonth: localDay.slice(0, 7),
    localHour: 12,
    localDow: 0,
    isWeekend: false,
    drinkKey: 'beer',
    count: 1,
    units,
    blackoutSession: false,
    ...overrides,
  };
}

const ms = (localDay: string) => new Date(`${localDay}T00:00:00`).getTime();

describe('buildMonthlyStats — same-chunk previous window', () => {
  it('clamps the previous month to the current month-to-date chunk', () => {
    // Viewing June while it is in progress (June 16).
    const now = new Date(2026, 5, 16, 12, 0, 0);
    const events = [
      event('2026-06-10', 5), // current month, day 10
      event('2026-05-10', 3), // previous month, within the 1–16 chunk
      event('2026-05-25', 100), // previous month, AFTER the chunk — must be excluded
    ];

    const {current, previous, isCurrentMonth} = buildMonthlyStats(
      events,
      2026,
      6,
      now,
      THRESHOLDS,
    );

    expect(isCurrentMonth).toBe(true);
    expect(current.elapsedDays).toBe(16);
    expect(current.totalUnits).toBe(5);
    // Previous window is May 1–16, so the May 25 spike is NOT counted.
    expect(previous.elapsedDays).toBe(16);
    expect(previous.totalUnits).toBe(3);
  });

  it('keeps the full previous month for a past complete month', () => {
    // It is June; viewing March (fully elapsed).
    const now = new Date(2026, 5, 16, 12, 0, 0);
    const events = [
      event('2026-03-10', 4),
      event('2026-02-25', 7), // late February — included only with a full window
    ];

    const {current, previous, isCurrentMonth} = buildMonthlyStats(
      events,
      2026,
      3,
      now,
      THRESHOLDS,
    );

    expect(isCurrentMonth).toBe(false);
    expect(current.elapsedDays).toBe(31);
    expect(previous.elapsedDays).toBe(28);
    expect(previous.totalUnits).toBe(7);
  });

  it('falls back to the whole short previous month near a long month end', () => {
    // March 30: 30 elapsed days, but February only has 28 — no overflow.
    const now = new Date(2026, 2, 30, 12, 0, 0);
    const events = [event('2026-03-05', 9), event('2026-02-15', 6)];

    const {current, previous} = buildMonthlyStats(
      events,
      2026,
      3,
      now,
      THRESHOLDS,
    );

    expect(current.elapsedDays).toBe(30);
    // Clamped to February's real length, not March 2.
    expect(previous.elapsedDays).toBe(28);
    expect(previous.totalUnits).toBe(6);
  });
});

describe('buildMonthlyStats — comparisonAvailable', () => {
  const earliest = ms('2026-01-01');

  it('is false for a future month (no elapsed days)', () => {
    const now = new Date(2026, 5, 16, 12, 0, 0);
    const {current, comparisonAvailable} = buildMonthlyStats(
      [event('2026-06-10', 5)],
      2026,
      7, // July — future
      now,
      THRESHOLDS,
      earliest,
    );
    expect(current.elapsedDays).toBe(0);
    expect(comparisonAvailable).toBe(false);
  });

  it('is false when the previous window predates the first tracked day', () => {
    // First ever activity April 5; viewing April ⇒ previous (March) has no baseline.
    const now = new Date(2026, 5, 16, 12, 0, 0);
    const {comparisonAvailable} = buildMonthlyStats(
      [event('2026-04-10', 5)],
      2026,
      4,
      now,
      THRESHOLDS,
      ms('2026-04-05'),
    );
    expect(comparisonAvailable).toBe(false);
  });

  it('is true for a normal month with a prior baseline', () => {
    const now = new Date(2026, 5, 16, 12, 0, 0);
    const {comparisonAvailable} = buildMonthlyStats(
      [event('2026-04-10', 5), event('2026-05-10', 3)],
      2026,
      5,
      now,
      THRESHOLDS,
      earliest,
    );
    expect(comparisonAvailable).toBe(true);
  });

  it('keeps the comparison for a genuinely alcohol-free tracked month', () => {
    // Tracking started in January; May and April have zero drinks but are still
    // tracked — the comparison stays available.
    const now = new Date(2026, 5, 16, 12, 0, 0);
    const {current, previous, comparisonAvailable} = buildMonthlyStats(
      [event('2026-01-10', 5)],
      2026,
      5,
      now,
      THRESHOLDS,
      earliest,
    );
    expect(current.totalUnits).toBe(0);
    expect(previous.totalUnits).toBe(0);
    expect(comparisonAvailable).toBe(true);
  });

  it('falls back to the earliest event when no floor is supplied', () => {
    const now = new Date(2026, 5, 16, 12, 0, 0);

    // First event is April 10 ⇒ viewing April has no baseline (March predates it).
    const firstMonth = buildMonthlyStats(
      [event('2026-04-10', 5)],
      2026,
      4,
      now,
      THRESHOLDS,
    );
    expect(firstMonth.comparisonAvailable).toBe(false);

    // With an earlier April event, May has a baseline.
    const laterMonth = buildMonthlyStats(
      [event('2026-04-10', 5), event('2026-05-10', 3)],
      2026,
      5,
      now,
      THRESHOLDS,
    );
    expect(laterMonth.comparisonAvailable).toBe(true);
  });
});
