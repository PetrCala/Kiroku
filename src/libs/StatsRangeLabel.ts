import {format, getDate, getYear} from 'date-fns';
import type {Locale as DateFnsLocale} from 'date-fns';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import type {Range} from '@components/StatsContextProvider/types';
import DateUtils from '@libs/DateUtils';
import type Locale from '@src/types/onyx/Locale';

type Translate = LocaleContextProps['translate'];

type GetStatsRangeLabelParams = {
  range: Range;
  translate: Translate;
  preferredLocale: Locale;
};

const EN_DASH = '–';

/** Abbreviated, standalone month name (e.g. "May"; Czech nominative). */
function shortMonth(date: Date, locale: DateFnsLocale): string {
  return format(date, 'LLL', {locale});
}

/** Full, standalone month name (e.g. "May"). */
function longMonth(date: Date, locale: DateFnsLocale): string {
  return format(date, 'LLLL', {locale});
}

/** Day-level span, e.g. "May 5 – 11, 2025" / "Apr 28 – May 4, 2025". */
function formatDaySpan(start: Date, end: Date, locale: DateFnsLocale): string {
  const startYear = getYear(start);
  const endYear = getYear(end);
  const sameYear = startYear === endYear;
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${shortMonth(start, locale)} ${getDate(start)} ${EN_DASH} ${getDate(end)}, ${endYear}`;
  }
  if (sameYear) {
    return `${shortMonth(start, locale)} ${getDate(start)} ${EN_DASH} ${shortMonth(end, locale)} ${getDate(end)}, ${endYear}`;
  }
  return `${shortMonth(start, locale)} ${getDate(start)}, ${startYear} ${EN_DASH} ${shortMonth(end, locale)} ${getDate(end)}, ${endYear}`;
}

/** Month-level span, e.g. "Jan – Jun 2026" / "Nov 2025 – May 2026". */
function formatMonthSpan(
  start: Date,
  end: Date,
  locale: DateFnsLocale,
): string {
  const startYear = getYear(start);
  const endYear = getYear(end);

  if (startYear === endYear) {
    return `${shortMonth(start, locale)} ${EN_DASH} ${shortMonth(end, locale)} ${endYear}`;
  }
  return `${shortMonth(start, locale)} ${startYear} ${EN_DASH} ${shortMonth(end, locale)} ${endYear}`;
}

/**
 * Localized, period-relative label for the statistics date range. Pure (no
 * hooks): `translate` and `preferredLocale` are injected so it stays
 * react-compiler-safe and unit-testable.
 *
 * Relative phrases ("This Week"/"This Month"/"This Year") render only at the
 * current period (offset 0); paged periods render an explicit, year-qualified
 * span so the user is never left guessing which window they're on.
 */
function getStatsRangeLabel({
  range,
  translate,
  preferredLocale,
}: GetStatsRangeLabelParams): string {
  const {preset, offset, start, end} = range;
  const locale = DateUtils.getDateFnsLocale(preferredLocale);
  const isCurrent = offset === 0;

  switch (preset) {
    case 'W':
      return isCurrent
        ? translate('statistics.filters.label.thisWeek')
        : formatDaySpan(start, end, locale);
    case 'M':
      return isCurrent
        ? translate('statistics.filters.label.thisMonth')
        : `${longMonth(start, locale)} ${getYear(start)}`;
    case '6M':
      return formatMonthSpan(start, end, locale);
    case 'Y':
      return isCurrent
        ? translate('statistics.filters.label.thisYear')
        : `${getYear(start)}`;
    case 'All':
      return translate('statistics.filters.label.allTime');
    case 'Custom':
    default:
      return formatDaySpan(start, end, locale);
  }
}

export default getStatsRangeLabel;
export type {GetStatsRangeLabelParams};
