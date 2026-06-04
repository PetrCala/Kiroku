/**
 * @jest-environment node
 */
import {summarizeAchievements, computeBadges} from '@libs/AchievementsUtils';
import type {AchievementsSummary} from '@libs/AchievementsUtils';
import type {DrinkEvent} from '@libs/Statistics';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/** Minimal DrinkEvent fixture — only localDay/units/sessionId matter here. */
function ev(localDay: string, units: number, sessionId?: string): DrinkEvent {
  return {
    userId: 'u1' as UserID,
    sessionId: sessionId ?? `s-${localDay}`,
    ts: Date.parse(`${localDay}T12:00:00Z`),
    localDay,
    localIsoWeek: '2026-W01',
    localMonth: localDay.slice(0, 7),
    localHour: 12,
    localDow: 1,
    isWeekend: false,
    drinkKey: 'beer' as DrinkKey,
    count: 1,
    units,
    blackoutSession: false,
  };
}

describe('summarizeAchievements', () => {
  it('returns an empty summary when there are no events', () => {
    expect(summarizeAchievements([], '2026-06-07')).toEqual({
      hasData: false,
      currentAfStreak: 0,
      longestAfStreak: 0,
      totalAfDays: 0,
      totalTrackedDays: 0,
      totalDrinkingDays: 0,
      totalSessions: 0,
      firstTrackedDay: null,
    });
  });

  it('computes streaks and counts across a gap (01 D, 02-04 AF, 05 D, 06-07 AF)', () => {
    const summary = summarizeAchievements(
      [ev('2026-06-01', 3), ev('2026-06-05', 2)],
      '2026-06-07',
    );
    expect(summary).toEqual({
      hasData: true,
      currentAfStreak: 2, // 06 + 07
      longestAfStreak: 3, // 02 + 03 + 04
      totalAfDays: 5,
      totalTrackedDays: 7,
      totalDrinkingDays: 2,
      totalSessions: 2,
      firstTrackedDay: '2026-06-01',
    });
  });

  it('resets the current streak to 0 when today is a drinking day', () => {
    const summary = summarizeAchievements([ev('2026-06-07', 4)], '2026-06-07');
    expect(summary.currentAfStreak).toBe(0);
    expect(summary.longestAfStreak).toBe(0);
    expect(summary.totalDrinkingDays).toBe(1);
    expect(summary.totalTrackedDays).toBe(1);
  });

  it('treats a day with only zero-unit drinks as alcohol-free', () => {
    const summary = summarizeAchievements([ev('2026-06-02', 0)], '2026-06-02');
    expect(summary.totalAfDays).toBe(1);
    expect(summary.currentAfStreak).toBe(1);
    expect(summary.totalDrinkingDays).toBe(0);
  });

  it('counts multiple drinks in one session/day once', () => {
    const summary = summarizeAchievements(
      [ev('2026-06-03', 2, 's1'), ev('2026-06-03', 1, 's1')],
      '2026-06-03',
    );
    expect(summary.totalSessions).toBe(1);
    expect(summary.totalDrinkingDays).toBe(1);
    expect(summary.totalTrackedDays).toBe(1);
  });
});

describe('computeBadges', () => {
  const summary: AchievementsSummary = {
    hasData: true,
    currentAfStreak: 2,
    longestAfStreak: 7,
    totalAfDays: 10,
    totalTrackedDays: 40,
    totalDrinkingDays: 30,
    totalSessions: 1,
    firstTrackedDay: '2026-05-01',
  };

  it('marks reached thresholds earned and clamps locked progress', () => {
    const byId = Object.fromEntries(
      computeBadges(summary).map(badge => [badge.id, badge]),
    );

    expect(byId.firstSession.earned).toBe(true);
    expect(byId.dryDay.earned).toBe(true);
    expect(byId.dryWeek).toMatchObject({earned: true, current: 7, target: 7});
    expect(byId.afDays10.earned).toBe(true);

    // Locked badges report clamped progress toward their target.
    expect(byId.dryFortnight).toMatchObject({
      earned: false,
      current: 7,
      target: 14,
    });
    expect(byId.dryMonth).toMatchObject({
      earned: false,
      current: 7,
      target: 30,
    });
    expect(byId.afDays50).toMatchObject({
      earned: false,
      current: 10,
      target: 50,
    });
    expect(byId.sessions25).toMatchObject({
      earned: false,
      current: 1,
      target: 25,
    });
  });

  it('returns all badges in stable display order', () => {
    expect(computeBadges(summary).map(badge => badge.id)).toEqual([
      'firstSession',
      'dryDay',
      'dryWeek',
      'dryFortnight',
      'dryMonth',
      'afDays10',
      'afDays50',
      'sessions25',
    ]);
  });
});
