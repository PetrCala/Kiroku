import {
  differenceInCalendarDays,
  differenceInMonths,
  differenceInYears,
} from 'date-fns';

type RelativeDayTier =
  | {unit: 'today' | 'yesterday'}
  | {unit: 'days' | 'months' | 'years'; count: number};

/**
 * Buckets how long ago `date` was, for day-granularity relative-time copy
 * ("Today" / "Yesterday" / "N days ago" / "N months ago" / "N years ago").
 *
 * Today, Yesterday, and days compare CALENDAR days, so a session late last
 * night is "Yesterday" even if only hours have passed. Months and years switch
 * over only once a FULL month/year has elapsed — never on a mere calendar
 * boundary crossing. A June 29 session viewed on July 2 is "3 days ago", not
 * "1 month ago"; a Dec 31 session viewed on Jan 1 is "Yesterday", not
 * "1 year ago". The days tier therefore runs up to ~30 before "1 month ago"
 * takes over, and months run up to 11 before "1 year ago".
 */
function getRelativeDayTier(date: Date, now: Date): RelativeDayTier {
  const years = differenceInYears(now, date);
  if (years >= 1) {
    return {unit: 'years', count: years};
  }
  const months = differenceInMonths(now, date);
  if (months >= 1) {
    return {unit: 'months', count: months};
  }
  const days = differenceInCalendarDays(now, date);
  if (days >= 2) {
    return {unit: 'days', count: days};
  }
  return {unit: days === 1 ? 'yesterday' : 'today'};
}

export default getRelativeDayTier;
export type {RelativeDayTier};
