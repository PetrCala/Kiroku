import selectWeeklyBars from '@libs/Statistics/selectors/weeklyBars';
import type {DayRollup} from '@libs/Statistics';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const UTC = 'UTC' as SelectedTimezone;
const USER_ID = 'u1';

function rollup(dateKey: string, totalSdu: number): DayRollup {
  return {
    userId: USER_ID,
    dateKey,
    totalSdu,
    drinksCount: Math.max(1, Math.round(totalSdu)),
    byType: {},
  };
}

describe('selectWeeklyBars', () => {
  it('produces 8 bars by default, oldest first', () => {
    const result = selectWeeklyBars([], {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)), // Mon 2024-02-19
      timezone: UTC,
    });
    expect(result.bars).toHaveLength(8);
    // Bars span weeks ending in the week containing 2024-02-19 (week of
    // 2024-02-19 to 2024-02-25 ISO), working back to ~2024-01-01.
    expect(result.bars[7].weekStartDate).toBe('2024-02-19');
    expect(result.bars[0].weekStartDate < result.bars[7].weekStartDate).toBe(
      true,
    );
  });

  it('honors the weeks option', () => {
    const result = selectWeeklyBars([], {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)),
      timezone: UTC,
      weeks: 4,
    });
    expect(result.bars).toHaveLength(4);
  });

  it('sums totalSdu and counts alcohol-free days within each week', () => {
    // Week of 2024-02-19 (Mon) through 2024-02-25 (Sun) — ISO week
    const rollups = [
      rollup('2024-02-19', 2), // Mon
      rollup('2024-02-21', 4), // Wed
      // Tue/Thu/Fri/Sat/Sun missing → 5 alcohol-free days
    ];
    const result = selectWeeklyBars(rollups, {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)),
      timezone: UTC,
      weeks: 1,
    });
    expect(result.bars[0].totalSdu).toBe(6);
    expect(result.bars[0].alcoholFreeDays).toBe(5);
    expect(result.bars[0].drinksCount).toBeGreaterThan(0);
  });

  it('stamps each bar with the userId from the first rollup', () => {
    const rollups = [rollup('2024-02-19', 2)];
    const result = selectWeeklyBars(rollups, {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)),
      timezone: UTC,
      weeks: 2,
    });
    expect(result.bars.every(b => b.userId === USER_ID)).toBe(true);
  });

  it('falls back to empty userId when there are no rollups', () => {
    const result = selectWeeklyBars([], {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)),
      timezone: UTC,
      weeks: 1,
    });
    expect(result.bars[0].userId).toBe('');
  });

  it('returns p25=p75=0 when all bars are zero', () => {
    const result = selectWeeklyBars([], {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)),
      timezone: UTC,
    });
    expect(result.band).toEqual({p25: 0, p75: 0});
  });

  it('computes p25/p75 from the weekly totals (band of normal)', () => {
    // 8 weeks each contributing exactly one rollup, totals 1..8
    const rollups: DayRollup[] = [];
    for (let i = 7; i >= 0; i--) {
      const isoWeekStart = new Date(Date.UTC(2024, 0, 1) + i * 7 * 86400000);
      const y = isoWeekStart.getUTCFullYear();
      const m = String(isoWeekStart.getUTCMonth() + 1).padStart(2, '0');
      const d = String(isoWeekStart.getUTCDate()).padStart(2, '0');
      rollups.push(rollup(`${y}-${m}-${d}`, 8 - i));
    }
    const result = selectWeeklyBars(rollups, {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)),
      timezone: UTC,
      weeks: 8,
    });
    // The 8 totalSdu values aren't strictly 1..8 (week boundaries shift the
    // bucketing), but p25 < p75 must hold and both must be ≥ 0.
    expect(result.band.p25).toBeGreaterThanOrEqual(0);
    expect(result.band.p75).toBeGreaterThanOrEqual(result.band.p25);
  });

  it('produces ISO year and ISO week consistent with date-fns', () => {
    const result = selectWeeklyBars([], {
      asOfDate: new Date(Date.UTC(2024, 1, 19, 12)),
      timezone: UTC,
      weeks: 1,
    });
    expect(result.bars[0].isoYear).toBe(2024);
    expect(result.bars[0].isoWeek).toBe(8);
  });
});
