import getRelativeDayTier from '@libs/getRelativeDayTier';
import type {RelativeDayTier} from '@libs/getRelativeDayTier';

describe('getRelativeDayTier', () => {
  describe('day tiers use calendar days', () => {
    test('same calendar day → today', () => {
      expect(
        getRelativeDayTier(
          new Date('2026-07-02T01:00:00'),
          new Date('2026-07-02T23:00:00'),
        ),
      ).toEqual({unit: 'today'});
    });

    test('previous calendar day → yesterday, even if only hours apart', () => {
      expect(
        getRelativeDayTier(
          new Date('2026-07-01T23:30:00'),
          new Date('2026-07-02T00:30:00'),
        ),
      ).toEqual({unit: 'yesterday'});
    });

    test('two calendar days back → 2 days ago', () => {
      expect(
        getRelativeDayTier(
          new Date('2026-06-30T22:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'days', count: 2});
    });
  });

  describe('calendar-boundary crossings stay in the finer tier', () => {
    test('Jun 29 viewed on Jul 2 → 3 days ago, NOT 1 month ago', () => {
      // Regression: differenceInCalendarMonths reported 1 here because the
      // month index changed, even though only 3 days had passed.
      expect(
        getRelativeDayTier(
          new Date('2026-06-29T21:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'days', count: 3});
    });

    test('Dec 31 viewed on Jan 1 → yesterday, NOT 1 year ago', () => {
      expect(
        getRelativeDayTier(
          new Date('2025-12-31T22:00:00'),
          new Date('2026-01-01T10:00:00'),
        ),
      ).toEqual({unit: 'yesterday'});
    });

    test('30 days across a month boundary, under a full month → 30 days ago', () => {
      expect(
        getRelativeDayTier(
          new Date('2026-06-02T21:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'days', count: 30});
    });
  });

  describe('months tier starts after a full month', () => {
    test('a full month plus a day → 1 month ago', () => {
      expect(
        getRelativeDayTier(
          new Date('2026-06-01T09:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'months', count: 1});
    });

    test('~5 weeks → 1 month ago, NOT 2 months ago', () => {
      // Regression: May 30 → Jul 2 crossed two month indexes (May→Jun→Jul) and
      // showed "2 months ago" after only 33 days.
      expect(
        getRelativeDayTier(
          new Date('2026-05-30T20:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'months', count: 1});
    });

    test('11 full months → 11 months ago, not yet a year', () => {
      expect(
        getRelativeDayTier(
          new Date('2025-07-10T12:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'months', count: 11});
    });
  });

  describe('years tier starts after a full year', () => {
    test('exactly one year → 1 year ago', () => {
      expect(
        getRelativeDayTier(
          new Date('2025-07-02T10:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'years', count: 1});
    });

    test('18 months → 1 year ago (full years, no rounding up)', () => {
      expect(
        getRelativeDayTier(
          new Date('2025-01-02T10:00:00'),
          new Date('2026-07-02T10:00:00'),
        ),
      ).toEqual({unit: 'years', count: 1});
    });
  });

  test('future date (clock skew) falls back to today', () => {
    const tier: RelativeDayTier = getRelativeDayTier(
      new Date('2026-07-03T10:00:00'),
      new Date('2026-07-02T10:00:00'),
    );
    expect(tier).toEqual({unit: 'today'});
  });
});
