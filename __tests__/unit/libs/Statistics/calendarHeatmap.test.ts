import selectCalendarHeatmap from '@libs/Statistics/selectors/calendarHeatmap';
import type {DayRollup} from '@libs/Statistics';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const UTC = 'UTC' as SelectedTimezone;
const USER_ID = 'u1';

function rollup(dateKey: string, totalSdu: number): DayRollup {
  return {userId: USER_ID, dateKey, totalSdu, drinksCount: 1, byType: {}};
}

describe('selectCalendarHeatmap', () => {
  it('produces one cell per day of the month containing monthAnchor', () => {
    const cells = selectCalendarHeatmap([], {
      monthAnchor: new Date(Date.UTC(2024, 0, 15)),
      timezone: UTC,
    });
    // January has 31 days
    expect(cells).toHaveLength(31);
    expect(cells[0].dateKey).toBe('2024-01-01');
    expect(cells[30].dateKey).toBe('2024-01-31');
    expect(cells.every(c => c.totalSdu === 0 && c.intensity === 0)).toBe(true);
  });

  it('handles February in a leap year (29 days)', () => {
    const cells = selectCalendarHeatmap([], {
      monthAnchor: new Date(Date.UTC(2024, 1, 10)),
      timezone: UTC,
    });
    expect(cells).toHaveLength(29);
  });

  it('fills in totalSdu from matching rollups', () => {
    const cells = selectCalendarHeatmap(
      [rollup('2024-01-10', 2.5), rollup('2024-01-20', 8)],
      {monthAnchor: new Date(Date.UTC(2024, 0, 15)), timezone: UTC},
    );
    expect(cells.find(c => c.dateKey === '2024-01-10')?.totalSdu).toBe(2.5);
    expect(cells.find(c => c.dateKey === '2024-01-20')?.totalSdu).toBe(8);
    expect(cells.find(c => c.dateKey === '2024-01-11')?.totalSdu).toBe(0);
  });

  it('buckets intensity 0/1/2/3/4 at the documented thresholds', () => {
    const cells = selectCalendarHeatmap(
      [
        rollup('2024-01-01', 0),
        rollup('2024-01-02', 0.5),
        rollup('2024-01-03', 1),
        rollup('2024-01-04', 2),
        rollup('2024-01-05', 3),
        rollup('2024-01-06', 4.5),
        rollup('2024-01-07', 6),
        rollup('2024-01-08', 10),
      ],
      {monthAnchor: new Date(Date.UTC(2024, 0, 1)), timezone: UTC},
    );
    const byDate = Object.fromEntries(cells.map(c => [c.dateKey, c.intensity]));
    expect(byDate['2024-01-01']).toBe(0);
    expect(byDate['2024-01-02']).toBe(1);
    expect(byDate['2024-01-03']).toBe(1);
    expect(byDate['2024-01-04']).toBe(2);
    expect(byDate['2024-01-05']).toBe(2);
    expect(byDate['2024-01-06']).toBe(3);
    expect(byDate['2024-01-07']).toBe(3);
    expect(byDate['2024-01-08']).toBe(4);
  });

  it('ignores rollups outside the target month', () => {
    const cells = selectCalendarHeatmap(
      [rollup('2024-02-05', 5), rollup('2024-01-10', 2)],
      {monthAnchor: new Date(Date.UTC(2024, 0, 15)), timezone: UTC},
    );
    expect(cells.find(c => c.dateKey === '2024-02-05')).toBeUndefined();
    expect(cells.find(c => c.dateKey === '2024-01-10')?.totalSdu).toBe(2);
  });
});
