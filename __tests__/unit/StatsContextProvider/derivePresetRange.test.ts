import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMilliseconds,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import derivePresetRange from '@components/StatsContextProvider/derivePresetRange';

// Thursday, 28 May 2026, 14:00 local.
const NOW = new Date(2026, 4, 28, 14, 0, 0);
const WEEK_OPTS = {weekStartsOn: 1 as const}; // Monday, per CONST.WEEK_STARTS_ON

describe('derivePresetRange', () => {
  describe('offset 0 reproduces the legacy "to date" window', () => {
    it('W: start of week → end of today', () => {
      const {start, end} = derivePresetRange({preset: 'W', now: NOW});
      expect(start).toEqual(startOfWeek(NOW, WEEK_OPTS));
      expect(end).toEqual(endOfDay(NOW));
    });

    it('M: start of month → end of today', () => {
      const {start, end} = derivePresetRange({preset: 'M', now: NOW});
      expect(start).toEqual(startOfMonth(NOW));
      expect(end).toEqual(endOfDay(NOW));
    });

    it('6M: trailing 6 months → end of today', () => {
      const {start, end} = derivePresetRange({preset: '6M', now: NOW});
      expect(start).toEqual(startOfDay(subMonths(NOW, 6)));
      expect(end).toEqual(endOfDay(NOW));
    });

    it('Y: start of year → end of today', () => {
      const {start, end} = derivePresetRange({preset: 'Y', now: NOW});
      expect(start).toEqual(startOfYear(NOW));
      expect(end).toEqual(endOfDay(NOW));
    });

    it('explicit offset 0 matches the default', () => {
      expect(derivePresetRange({preset: 'M', now: NOW, offset: 0})).toEqual(
        derivePresetRange({preset: 'M', now: NOW}),
      );
    });
  });

  describe('offset < 0 yields the full prior period', () => {
    it('W: the previous whole week (Mon–Sun)', () => {
      const {start, end} = derivePresetRange({
        preset: 'W',
        now: NOW,
        offset: -1,
      });
      const base = subWeeks(NOW, 1);
      expect(start).toEqual(startOfWeek(base, WEEK_OPTS));
      expect(end).toEqual(endOfWeek(base, WEEK_OPTS));
    });

    it('M: the previous whole month', () => {
      const {start, end} = derivePresetRange({
        preset: 'M',
        now: NOW,
        offset: -1,
      });
      const base = subMonths(NOW, 1);
      expect(start).toEqual(startOfMonth(base));
      expect(end).toEqual(endOfMonth(base));
    });

    it('Y: the previous whole calendar year', () => {
      const {start, end} = derivePresetRange({
        preset: 'Y',
        now: NOW,
        offset: -1,
      });
      const base = subYears(NOW, 1);
      expect(start).toEqual(startOfYear(base));
      expect(end).toEqual(endOfYear(base));
    });

    it('6M: contiguous trailing window ending just before the current one', () => {
      const current = derivePresetRange({preset: '6M', now: NOW});
      const prior = derivePresetRange({preset: '6M', now: NOW, offset: -1});
      expect(prior.start).toEqual(startOfDay(subMonths(NOW, 12)));
      expect(prior.end).toEqual(
        subMilliseconds(startOfDay(subMonths(NOW, 6)), 1),
      );
      // No overlap with the current window.
      expect(prior.end.getTime()).toBeLessThan(current.start.getTime());
    });

    it('M: stepping two months back', () => {
      const {start, end} = derivePresetRange({
        preset: 'M',
        now: NOW,
        offset: -2,
      });
      const base = subMonths(NOW, 2);
      expect(start).toEqual(startOfMonth(base));
      expect(end).toEqual(endOfMonth(base));
    });
  });

  describe('All and Custom ignore offset', () => {
    it('All: same window regardless of offset', () => {
      const earliestSessionAt = new Date(2023, 2, 1);
      const base = derivePresetRange({
        preset: 'All',
        now: NOW,
        earliestSessionAt,
      });
      const paged = derivePresetRange({
        preset: 'All',
        now: NOW,
        offset: -3,
        earliestSessionAt,
      });
      expect(paged).toEqual(base);
      expect(paged.start).toEqual(earliestSessionAt);
    });

    it('Custom: same window regardless of offset', () => {
      const customStart = new Date(2026, 2, 3);
      const customEnd = new Date(2026, 3, 18);
      const base = derivePresetRange({
        preset: 'Custom',
        now: NOW,
        customStart,
        customEnd,
      });
      const paged = derivePresetRange({
        preset: 'Custom',
        now: NOW,
        offset: -5,
        customStart,
        customEnd,
      });
      expect(paged).toEqual(base);
      expect(paged.start).toEqual(customStart);
      expect(paged.end).toEqual(customEnd);
    });
  });
});
