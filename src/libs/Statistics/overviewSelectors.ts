import type {DrinkEvent} from './types';

const SPARSE_WEEK_THRESHOLD = 4;

/**
 * True when there's too little history for the scorecard to be meaningful:
 * no events at all, or fewer than {@link SPARSE_WEEK_THRESHOLD} distinct weeks
 * with data. Drives the "still building" footer copy.
 */
function selectIsSparse(
  events: readonly DrinkEvent[],
  weeksWithData: number,
): boolean {
  return events.length === 0 || weeksWithData < SPARSE_WEEK_THRESHOLD;
}

function selectHasEverLogged(events: readonly DrinkEvent[]): boolean {
  return events.length > 0;
}

export {SPARSE_WEEK_THRESHOLD, selectHasEverLogged, selectIsSparse};
