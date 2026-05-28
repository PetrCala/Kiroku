import getStatsRangeLabel from '@libs/StatsRangeLabel';
import type {Range} from '@components/StatsContextProvider/types';
import CONST from '@src/CONST';
import type Locale from '@src/types/onyx/Locale';

// Mock translate: echo the key so relative phrases are assertable.
const translate = ((key: string) => key) as unknown as Parameters<
  typeof getStatsRangeLabel
>[0]['translate'];

function makeRange(overrides: Partial<Range>): Range {
  return {
    preset: 'M',
    offset: 0,
    start: new Date(2026, 4, 1),
    end: new Date(2026, 4, 28, 23, 59, 59, 999),
    isPageable: true,
    canGoPrev: true,
    canGoNext: false,
    isLatest: true,
    ...overrides,
  };
}

const EN = CONST.LOCALES.EN;

function label(range: Range, preferredLocale: Locale = EN): string {
  return getStatsRangeLabel({range, translate, preferredLocale});
}

describe('getStatsRangeLabel (en)', () => {
  it('W at offset 0 → relative "This Week" key', () => {
    expect(label(makeRange({preset: 'W', offset: 0}))).toBe(
      'statistics.filters.label.thisWeek',
    );
  });

  it('W paged → day span with year (same month collapses the month)', () => {
    const range = makeRange({
      preset: 'W',
      offset: -1,
      start: new Date(2026, 4, 18),
      end: new Date(2026, 4, 24, 23, 59, 59, 999),
    });
    expect(label(range)).toBe('May 18 – 24, 2026');
  });

  it('W paged across two months → both months shown', () => {
    const range = makeRange({
      preset: 'W',
      offset: -1,
      start: new Date(2026, 3, 27),
      end: new Date(2026, 4, 3, 23, 59, 59, 999),
    });
    expect(label(range)).toBe('Apr 27 – May 3, 2026');
  });

  it('M at offset 0 → relative "This Month" key', () => {
    expect(label(makeRange({preset: 'M', offset: 0}))).toBe(
      'statistics.filters.label.thisMonth',
    );
  });

  it('M paged → full month and year', () => {
    const range = makeRange({
      preset: 'M',
      offset: -1,
      start: new Date(2026, 3, 1),
      end: new Date(2026, 3, 30, 23, 59, 59, 999),
    });
    expect(label(range)).toBe('April 2026');
  });

  it('6M spanning two years → both years shown', () => {
    const range = makeRange({
      preset: '6M',
      offset: 0,
      start: new Date(2025, 10, 28),
      end: new Date(2026, 4, 28, 23, 59, 59, 999),
    });
    expect(label(range)).toBe('Nov 2025 – May 2026');
  });

  it('6M within a single year → year shown once', () => {
    const range = makeRange({
      preset: '6M',
      offset: -1,
      start: new Date(2026, 0, 1),
      end: new Date(2026, 5, 30, 23, 59, 59, 999),
    });
    expect(label(range)).toBe('Jan – Jun 2026');
  });

  it('Y at offset 0 → relative "This Year" key', () => {
    expect(label(makeRange({preset: 'Y', offset: 0}))).toBe(
      'statistics.filters.label.thisYear',
    );
  });

  it('Y paged → the year', () => {
    const range = makeRange({
      preset: 'Y',
      offset: -1,
      start: new Date(2025, 0, 1),
      end: new Date(2025, 11, 31, 23, 59, 59, 999),
    });
    expect(label(range)).toBe('2025');
  });

  it('All → "All time" key', () => {
    expect(label(makeRange({preset: 'All', isPageable: false}))).toBe(
      'statistics.filters.label.allTime',
    );
  });

  it('Custom → full day span with year', () => {
    const range = makeRange({
      preset: 'Custom',
      isPageable: false,
      start: new Date(2026, 2, 3),
      end: new Date(2026, 3, 18, 23, 59, 59, 999),
    });
    expect(label(range)).toBe('Mar 3 – Apr 18, 2026');
  });
});

describe('getStatsRangeLabel (cs_cz)', () => {
  it('uses localized standalone month names', () => {
    const range = makeRange({
      preset: 'M',
      offset: -1,
      start: new Date(2026, 3, 1),
      end: new Date(2026, 3, 30, 23, 59, 59, 999),
    });
    const result = label(range, CONST.LOCALES.CS_CZ).toLowerCase();
    expect(result).toContain('duben');
    expect(result).toContain('2026');
  });
});
