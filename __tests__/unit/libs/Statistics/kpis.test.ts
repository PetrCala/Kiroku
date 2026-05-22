/* eslint-disable @typescript-eslint/naming-convention -- date keys */
import selectKpis from '@libs/Statistics/selectors/kpis';
import type {DayRollup, KpiValue} from '@libs/Statistics';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const UTC = 'UTC' as SelectedTimezone;
const USER_ID = 'u1';

function rollup(dateKey: string, totalSdu: number): DayRollup {
  return {
    userId: USER_ID,
    dateKey,
    totalSdu,
    drinksCount: 1,
    byType: {},
  };
}

function findKpi(kpis: KpiValue[], key: KpiValue['key']): KpiValue {
  const k = kpis.find(x => x.key === key);
  if (!k) {
    throw new Error(`No KPI for ${key}`);
  }
  return k;
}

function findDelta(
  kpis: KpiValue[],
  key: KpiValue['key'],
): NonNullable<KpiValue['delta']> {
  const delta = findKpi(kpis, key).delta;
  if (!delta) {
    throw new Error(`KPI ${key} has no delta`);
  }
  return delta;
}

describe('selectKpis', () => {
  // Anchor: Wednesday 2024-02-21 12:00 UTC.
  // ISO week of 2024-02-21 runs Mon 2024-02-19 → Sun 2024-02-25.
  // Prior week: Mon 2024-02-12 → Sun 2024-02-18.
  // Month: February 2024 (29 days).
  const ASOF = new Date(Date.UTC(2024, 1, 21, 12));

  describe('alcoholFreeDays (this month)', () => {
    it('equals total days in month when there are no rollups', () => {
      const kpis = selectKpis([], {}, {asOfDate: ASOF, timezone: UTC});
      expect(findKpi(kpis, 'alcoholFreeDays').value).toBe(29);
    });

    it('decreases by one per distinct day with a rollup', () => {
      const kpis = selectKpis(
        [
          rollup('2024-02-05', 1),
          rollup('2024-02-10', 2),
          rollup('2024-02-25', 3),
        ],
        {},
        {asOfDate: ASOF, timezone: UTC},
      );
      expect(findKpi(kpis, 'alcoholFreeDays').value).toBe(26);
    });

    it('ignores rollups outside the target month', () => {
      const kpis = selectKpis(
        [rollup('2024-01-31', 5), rollup('2024-03-01', 5)],
        {},
        {asOfDate: ASOF, timezone: UTC},
      );
      expect(findKpi(kpis, 'alcoholFreeDays').value).toBe(29);
    });
  });

  describe('totalUnitsThisWeek', () => {
    it('sums totalSdu across this-week days', () => {
      const kpis = selectKpis(
        [
          rollup('2024-02-19', 2),
          rollup('2024-02-22', 3),
          rollup('2024-02-25', 1),
        ],
        {},
        {asOfDate: ASOF, timezone: UTC},
      );
      expect(findKpi(kpis, 'totalUnitsThisWeek').value).toBe(6);
    });

    it('emits a delta vs last week', () => {
      const kpis = selectKpis(
        [
          rollup('2024-02-12', 10), // last week
          rollup('2024-02-21', 4), //  this week
        ],
        {},
        {asOfDate: ASOF, timezone: UTC},
      );
      const delta = findDelta(kpis, 'totalUnitsThisWeek');
      expect(delta.direction).toBe('down');
      expect(delta.value).toBe(-6);
      expect(delta.comparisonKey).toBe('vsLastWeek');
    });

    it("marks the delta 'flat' when this and last week are equal", () => {
      const kpis = selectKpis(
        [rollup('2024-02-13', 3), rollup('2024-02-20', 3)],
        {},
        {asOfDate: ASOF, timezone: UTC},
      );
      const delta = findDelta(kpis, 'totalUnitsThisWeek');
      expect(delta.direction).toBe('flat');
      expect(delta.value).toBe(0);
    });
  });

  describe('sessionsThisWeek', () => {
    it('counts sessions in this-week range', () => {
      const sessionCounts = {
        '2024-02-19': 1,
        '2024-02-22': 2,
        '2024-02-12': 1, // last week
      };
      const kpis = selectKpis([], sessionCounts, {
        asOfDate: ASOF,
        timezone: UTC,
      });
      expect(findKpi(kpis, 'sessionsThisWeek').value).toBe(3);
    });

    it('emits a delta vs last week', () => {
      const sessionCounts = {
        '2024-02-12': 4, // last week
        '2024-02-20': 1, // this week
      };
      const kpis = selectKpis([], sessionCounts, {
        asOfDate: ASOF,
        timezone: UTC,
      });
      const delta = findDelta(kpis, 'sessionsThisWeek');
      expect(delta.direction).toBe('down');
      expect(delta.value).toBe(-3);
    });
  });

  describe('avgUnitsPerSession (rolling 30d)', () => {
    it('equals 0 when there are no sessions in the window', () => {
      const kpis = selectKpis([], {}, {asOfDate: ASOF, timezone: UTC});
      expect(findKpi(kpis, 'avgUnitsPerSession').value).toBe(0);
    });

    it('divides total SDU by session count in the rolling 30 days', () => {
      // 30-day window: 2024-01-23 → 2024-02-21 (inclusive of anchor day).
      const rollups = [rollup('2024-02-01', 4), rollup('2024-02-10', 6)];
      const sessionCounts = {
        '2024-02-01': 2,
        '2024-02-10': 3,
      };
      const kpis = selectKpis(rollups, sessionCounts, {
        asOfDate: ASOF,
        timezone: UTC,
      });
      // 10 SDU / 5 sessions = 2.0
      expect(findKpi(kpis, 'avgUnitsPerSession').value).toBe(2);
    });

    it('excludes data from before the 30-day window', () => {
      const rollups = [
        rollup('2024-01-10', 100), // outside window
        rollup('2024-02-15', 2),
      ];
      const sessionCounts = {'2024-02-15': 1};
      const kpis = selectKpis(rollups, sessionCounts, {
        asOfDate: ASOF,
        timezone: UTC,
      });
      expect(findKpi(kpis, 'avgUnitsPerSession').value).toBe(2);
    });
  });

  it('returns exactly the four v1 KPIs in stable order', () => {
    const kpis = selectKpis([], {}, {asOfDate: ASOF, timezone: UTC});
    expect(kpis.map(k => k.key)).toEqual([
      'alcoholFreeDays',
      'sessionsThisWeek',
      'avgUnitsPerSession',
      'totalUnitsThisWeek',
    ]);
  });
});
