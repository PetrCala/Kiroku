import {format, parseISO} from 'date-fns';

/**
 * ISO-week label (`2026-W22`) → short month (`May`). Falls back to the raw
 * value if it can't be parsed.
 */
function monthFromIsoWeek(isoWeek: string): string {
  const date = parseISO(isoWeek);
  return Number.isNaN(date.getTime()) ? isoWeek : format(date, 'MMM');
}

/**
 * ISO date (`2026-05-15`) → short month (`May`). Falls back to the raw value
 * if it can't be parsed.
 */
function monthFromDate(dateKey: string): string {
  const date = parseISO(dateKey);
  return Number.isNaN(date.getTime()) ? dateKey : format(date, 'MMM');
}

/** Round a numeric axis tick to a whole number. */
function roundTick(value: number): string {
  return String(Math.round(value));
}

export {monthFromDate, monthFromIsoWeek, roundTick};
