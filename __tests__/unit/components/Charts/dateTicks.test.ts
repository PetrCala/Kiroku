/**
 * @jest-environment node
 */

import buildDateTicks from '@components/Charts/BaseChart/dateTicks';
import CONST from '@src/CONST';

type Params = Parameters<typeof buildDateTicks>[0];

/** The English cases below predate localized labels; keep them explicit. */
function inEnglish(params: Omit<Params, 'preferredLocale'>) {
  return buildDateTicks({...params, preferredLocale: CONST.LOCALES.EN});
}

function inCzech(params: Omit<Params, 'preferredLocale'>) {
  return buildDateTicks({...params, preferredLocale: CONST.LOCALES.CS_CZ});
}

describe('buildDateTicks', () => {
  describe('day mode (span ≤ 31 days)', () => {
    test('daily series keeps evenly-spaced MMM d ticks', () => {
      const out = inEnglish({
        firstKey: '2026-06-01',
        lastKey: '2026-06-30',
        length: 30,
        unit: 'day',
      });
      expect(out.indices).toEqual([0, 7, 15, 22, 29]);
      expect(out.labelFor(0)).toBe('Jun 1');
      expect(out.labelFor(7)).toBe('Jun 8');
      expect(out.labelFor(29)).toBe('Jun 30');
    });

    test('weekly series labels each tick with its Monday', () => {
      // 2026-W19..W22 — Mondays May 4 through May 25; span 28 days.
      const out = inEnglish({
        firstKey: '2026-W19',
        lastKey: '2026-W22',
        length: 4,
        unit: 'week',
      });
      expect(out.indices).toEqual([0, 1, 2, 3]);
      expect(out.indices.map(i => out.labelFor(i))).toEqual([
        'May 4',
        'May 11',
        'May 18',
        'May 25',
      ]);
    });
  });

  describe('month mode (32 days – 3 years)', () => {
    test('snaps to month starts within one year and downsamples to 5', () => {
      const out = inEnglish({
        firstKey: '2025-01-01',
        lastKey: '2025-12-31',
        length: 365,
        unit: 'day',
      });
      // 12 month boundaries → even spread of 5 keeping first and last.
      expect(out.indices).toEqual([0, 90, 181, 243, 334]);
      expect(out.indices.map(i => out.labelFor(i))).toEqual([
        'Jan',
        'Apr',
        'Jul',
        'Sep',
        'Dec',
      ]);
      // Single-year ranges never carry a year suffix.
      for (const index of out.indices) {
        expect(out.labelFor(index)).not.toContain("'");
      }
    });

    test('year-crossing weekly window suffixes years and labels by boundary month', () => {
      // 2025-W46 (Mon Nov 10 2025) .. 2026-W19 (Mon May 4 2026) — a 6M-style
      // trailing window straddling Jan 1.
      const out = inEnglish({
        firstKey: '2025-W46',
        lastKey: '2026-W19',
        length: 26,
        unit: 'week',
      });
      expect(out.indices).toEqual([3, 7, 15, 20, 24]);
      expect(out.indices.map(i => out.labelFor(i))).toEqual([
        "Dec '25",
        "Jan '26",
        "Mar '26",
        "Apr '26",
        "May '26",
      ]);
      // Index 15 is the week of Mon Feb 23 2026 — the label must come from
      // the Mar 1 boundary, not the week key's Monday.
      expect(out.labelFor(15)).toBe("Mar '26");
    });

    test('multi-year range keeps months with a year suffix', () => {
      const out = inEnglish({
        firstKey: '2024-07-01',
        lastKey: '2026-06-12',
        length: 712,
        unit: 'day',
      });
      expect(out.indices).toHaveLength(5);
      const labels = out.indices.map(i => out.labelFor(i));
      expect(labels[0]).toBe("Jul '24");
      expect(labels[labels.length - 1]).toBe("Jun '26");
      for (const label of labels) {
        expect(label).toMatch(/^[A-Z][a-z]{2} '\d{2}$/);
      }
    });

    test('falls back to day ticks when fewer than 3 month starts exist', () => {
      // 45 days, only Feb 1 and Mar 1 boundaries.
      const out = inEnglish({
        firstKey: '2026-01-20',
        lastKey: '2026-03-05',
        length: 45,
        unit: 'day',
      });
      expect(out.indices).toEqual([0, 11, 22, 33, 44]);
      expect(out.labelFor(0)).toBe('Jan 20');
      expect(out.labelFor(44)).toBe('Mar 5');
    });

    test('weekly snapping maps boundaries to unique increasing indices', () => {
      // 2026-W01 starts Mon Dec 29 2025; Jan 1 falls in week 0, Feb 1
      // (a Sunday) in the week of Mon Jan 26 (index 4), Mar 1 in index 8.
      const out = inEnglish({
        firstKey: '2026-W01',
        lastKey: '2026-W10',
        length: 10,
        unit: 'week',
      });
      expect(out.indices).toEqual([0, 4, 8]);
      expect(out.indices.map(i => out.labelFor(i))).toEqual([
        'Jan',
        'Feb',
        'Mar',
      ]);
      // The Dec 29 series start is not a tick boundary, so all boundaries
      // share 2026 and no year suffix appears.
    });
  });

  describe('year mode (span > 3 years)', () => {
    test('ticks on Jan 1 with yyyy labels', () => {
      const out = inEnglish({
        firstKey: '2021-03-15',
        lastKey: '2026-06-12',
        length: 1916,
        unit: 'day',
      });
      expect(out.indices.map(i => out.labelFor(i))).toEqual([
        '2022',
        '2023',
        '2024',
        '2025',
        '2026',
      ]);
      const sorted = [...out.indices].sort((a, b) => a - b);
      expect(out.indices).toEqual(sorted);
    });
  });

  describe('localization', () => {
    // Regression: every label used to come from a bare date-fns `format()`
    // with no locale, so a Czech chart rendered English month names ("Týden
    // od Aug 3"). Two of six Czech App Store screenshots shipped that way.
    test('day ticks use the locale month name and its day-first order', () => {
      const out = inCzech({
        firstKey: '2026-06-01',
        lastKey: '2026-06-30',
        length: 30,
        unit: 'day',
      });
      expect(out.labelFor(0)).toBe('1. Čvn');
      expect(out.labelFor(29)).toBe('30. Čvn');
    });

    test('snapped month ticks use the locale month name', () => {
      const out = inCzech({
        firstKey: '2025-01-01',
        lastKey: '2025-12-31',
        length: 365,
        unit: 'day',
      });
      const labels = out.indices.map(i => out.labelFor(i));
      expect(labels).toEqual(['Led', 'Dub', 'Čvc', 'Zář', 'Pro']);
    });

    test('year labels are numeric and so identical across locales', () => {
      const params = {
        firstKey: '2021-03-15',
        lastKey: '2026-06-12',
        length: 1916,
        unit: 'day',
      } as const;
      const czech = inCzech(params);
      const english = inEnglish(params);
      expect(czech.indices.map(i => czech.labelFor(i))).toEqual(
        english.indices.map(i => english.labelFor(i)),
      );
    });
  });

  describe('guards', () => {
    test('empty series yields no ticks', () => {
      const out = inEnglish({
        firstKey: '',
        lastKey: '',
        length: 0,
        unit: 'day',
      });
      expect(out.indices).toEqual([]);
      expect(out.labelFor(0)).toBe('');
    });

    test('unparseable keys yield no ticks', () => {
      const out = inEnglish({
        firstKey: 'not-a-date',
        lastKey: 'also-not',
        length: 10,
        unit: 'day',
      });
      expect(out.indices).toEqual([]);
      expect(out.labelFor(0)).toBe('');
    });

    test('single point gets one MMM d tick', () => {
      const out = inEnglish({
        firstKey: '2026-06-12',
        lastKey: '2026-06-12',
        length: 1,
        unit: 'day',
      });
      expect(out.indices).toEqual([0]);
      expect(out.labelFor(0)).toBe('Jun 12');
    });
  });
});
