import {monthsBackFor} from '@components/StatsContextProvider';

describe('monthsBackFor', () => {
  const now = new Date(2026, 4, 15, 12, 0, 0); // 2026-05-15

  it('is 0 for a start within the current month', () => {
    expect(monthsBackFor(now, new Date(2026, 4, 1))).toBe(0);
    expect(monthsBackFor(now, now)).toBe(0);
  });

  it('counts whole calendar months back', () => {
    expect(monthsBackFor(now, new Date(2026, 3, 20))).toBe(1); // April
    expect(monthsBackFor(now, new Date(2025, 10, 1))).toBe(6); // Nov 2025
    expect(monthsBackFor(now, new Date(2025, 4, 15))).toBe(12); // a year back
  });

  it('clamps future starts to 0', () => {
    expect(monthsBackFor(now, new Date(2026, 7, 1))).toBe(0);
  });

  it('handles a far-past (All) start', () => {
    // 2011-01 → 2026-05 ≈ 15y4m = 184 months.
    expect(monthsBackFor(now, new Date(2011, 0, 1))).toBe(184);
  });
});
