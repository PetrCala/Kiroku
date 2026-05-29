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

/**
 * Up to `count` evenly-spaced integer indices across `[0, length-1]`. Used as
 * explicit x-axis `tickValues` for index-based charts so victory places labels
 * on real data points (integers) rather than interpolated fractions.
 */
function tickIndices(length: number, count = 5): number[] {
  if (length <= 0) {
    return [];
  }
  if (length <= count) {
    return Array.from({length}, (_, i) => i);
  }
  const step = (length - 1) / (count - 1);
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    indices.push(Math.round(i * step));
  }
  return Array.from(new Set(indices));
}

/** Up to `count` rounded value ticks across `[0, max]` (deduped). */
function valueTicks(max: number, count = 4): number[] {
  if (max <= 0) {
    return [0];
  }
  const step = max / (count - 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    ticks.push(Math.round(i * step));
  }
  return Array.from(new Set(ticks));
}

export {formatDayTick, formatWeekTick, roundTick, tickIndices, valueTicks};
