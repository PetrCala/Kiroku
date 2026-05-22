import {differenceInCalendarMonths} from 'date-fns';

/**
 * Decide whether a fullscreen-calendar scroll should trigger another
 * `loadUpTo(target)` and, if so, what target Date to use.
 *
 * Returns `null` when the request is a no-op:
 *   - `earliestVisible` is still more than `bufferMonths` ahead of `floorDate`,
 *     i.e. we haven't entered the pre-load window yet;
 *   - the computed target isn't deeper (earlier) than `deepestRequested`, so
 *     we've already asked for this depth on a prior scroll tick.
 *
 * The "deepest requested" coalesce is what keeps a fast fling from spamming
 * the friend-data fetcher: the orchestrator stores the returned target in a
 * ref and passes it back here on the next visible-months change.
 */
function computeLoadTarget(
  earliestVisible: Date,
  floorDate: Date,
  deepestRequested: Date | null,
  bufferMonths: number,
): Date | null {
  const monthsAhead = differenceInCalendarMonths(earliestVisible, floorDate);
  if (monthsAhead > bufferMonths) {
    return null;
  }
  const target = new Date(
    earliestVisible.getFullYear(),
    earliestVisible.getMonth() - bufferMonths,
    1,
  );
  if (deepestRequested && target >= deepestRequested) {
    return null;
  }
  return target;
}

// eslint-disable-next-line import/prefer-default-export
export {computeLoadTarget};
