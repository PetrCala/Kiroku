import {format, parseISO} from 'date-fns';

/**
 * ISO-week label (`2026-W22`) → week-start `MMM d` (`May 4`). Includes the day
 * so adjacent weeks in the same month don't render identical ticks (e.g.
 * `May · May · May`). Falls back to the raw value if it can't be parsed.
 */
function formatWeekTick(isoWeek: string): string {
  const date = parseISO(isoWeek);
  return Number.isNaN(date.getTime()) ? isoWeek : format(date, 'MMM d');
}

/**
 * ISO date (`2026-05-15`) → `MMM d` (`May 15`). Day-level so ticks within a
 * single month stay distinct. Falls back to the raw value if unparseable.
 */
function formatDayTick(dateKey: string): string {
  const date = parseISO(dateKey);
  return Number.isNaN(date.getTime()) ? dateKey : format(date, 'MMM d');
}

/** Round a numeric axis tick to a whole number. */
function roundTick(value: number): string {
  return String(Math.round(value));
}

export {formatDayTick, formatWeekTick, roundTick};
