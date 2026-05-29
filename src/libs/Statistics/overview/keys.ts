import {
  addDays,
  addMonths,
  addYears,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns';

/**
 * Ordered `yyyy-MM-dd` keys covering the inclusive `[start, end]` window, one
 * per calendar day. Matches the `localDay` field on `DrinkEvent`, so
 * `aggregate(events, byDay, …)` lookups line up index-for-index.
 */
function dayKeysInRange(start: Date, end: Date): string[] {
  const labels: string[] = [];
  let current = startOfDay(start);
  const last = startOfDay(end);
  while (current.getTime() <= last.getTime()) {
    labels.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }
  return labels;
}

/** Ordered `yyyy-MM` keys covering `[start, end]`, matching `byMonth`. */
function monthKeysInRange(start: Date, end: Date): string[] {
  const labels: string[] = [];
  let current = startOfMonth(start);
  const last = startOfMonth(end);
  while (current.getTime() <= last.getTime()) {
    labels.push(format(current, 'yyyy-MM'));
    current = addMonths(current, 1);
  }
  return labels;
}

/** Ordered `yyyy` keys covering `[start, end]`, matching `byYear`. */
function yearKeysInRange(start: Date, end: Date): string[] {
  const labels: string[] = [];
  let current = startOfYear(start);
  const last = startOfYear(end);
  while (current.getTime() <= last.getTime()) {
    labels.push(format(current, 'yyyy'));
    current = addYears(current, 1);
  }
  return labels;
}

export {dayKeysInRange, monthKeysInRange, yearKeysInRange};
