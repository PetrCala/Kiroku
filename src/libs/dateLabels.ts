import {format, getDate} from 'date-fns';
import type {Locale as DateFnsLocale} from 'date-fns';
import Str from '@libs/common/str';

/**
 * Short, localized date labels for axes and compact lists.
 *
 * Every helper takes an explicit date-fns locale rather than reading a global.
 * Chart labels are built inside `useMemo`, so a locale read from module scope
 * would leave cached labels in the old language after a language switch until
 * the component remounted. Resolve the locale with
 * `DateUtils.getDateFnsLocale(preferredLocale)` at the call site and pass it
 * down, the same way `StatsRangeLabel` does.
 *
 * `Str.UCFirst` capitalizes the first letter so Czech's lowercase month and
 * weekday names ("kvě", "pondělí") match the English convention. No-op for
 * English.
 */

/** Abbreviated, standalone month name (e.g. "May"; Czech nominative). */
function shortMonth(date: Date, locale: DateFnsLocale): string {
  return Str.UCFirst(format(date, 'LLL', {locale}));
}

/** Full, standalone month name (e.g. "May"). */
function longMonth(date: Date, locale: DateFnsLocale): string {
  return Str.UCFirst(format(date, 'LLLL', {locale}));
}

/** Abbreviated, standalone weekday name (e.g. "Mon", "Po"). */
function shortWeekday(date: Date, locale: DateFnsLocale): string {
  return Str.UCFirst(format(date, 'EEE', {locale}));
}

/**
 * Day and month in the locale's own order, read off the locale's short date
 * pattern rather than hardcoded per language: `MM/dd/yyyy` (en-US) puts the
 * month first, `dd.MM.y` (cs) puts the day first and marks it with a period.
 * A locale that separates with something else (`dd/MM/y`) gets a bare day.
 */
function dayAndShortMonth(date: Date, locale: DateFnsLocale): string {
  const pattern = locale.formatLong?.date({width: 'short'}) ?? '';
  const dayAt = pattern.indexOf('d');
  const monthAt = pattern.indexOf('M');
  const month = shortMonth(date, locale);
  const day = getDate(date);
  if (dayAt === -1 || monthAt === -1 || dayAt > monthAt) {
    return `${month} ${day}`;
  }
  return /d+\./.test(pattern) ? `${day}. ${month}` : `${day} ${month}`;
}

export {dayAndShortMonth, longMonth, shortMonth, shortWeekday};
