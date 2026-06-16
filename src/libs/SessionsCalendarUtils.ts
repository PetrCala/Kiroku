import {differenceInCalendarMonths, startOfMonth, subMonths} from 'date-fns';

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

/**
 * The loaded-window floor a compact (paged) calendar must reach so the month
 * about to become visible — plus a small look-ahead buffer that pre-warms the
 * windowed friend fetch — is always inside the derived/fetched range.
 *
 * Driving every page-back through `loadUpTo(getCompactCalendarLoadTarget(...))`
 * is what makes the newly shown month's data appear immediately, instead of
 * blank until the user pages again (Rule 1: data is always rendered, no
 * in-calendar navigation needed for it to appear). `loadUpTo` is monotonic and,
 * for the signed-in user, capped at their earliest tracked month, so requesting
 * a buffer never derives empty pre-tracking months — it only guarantees
 * coverage of the visible month.
 *
 * @param nextVisibleMonth Any day inside the month that is about to be shown.
 * @param bufferMonths How many extra months below it to pre-load (clamped at 0).
 * @returns The start of `bufferMonths` before `nextVisibleMonth`.
 */
function getCompactCalendarLoadTarget(
  nextVisibleMonth: Date,
  bufferMonths: number,
): Date {
  return startOfMonth(subMonths(nextVisibleMonth, Math.max(0, bufferMonths)));
}

/** Which value a profile/home calendar should open on. */
type CalendarVisibleSource = 'lastViewed' | 'local' | 'today';

/**
 * Pick the source for a profile/home calendar's visible month.
 *
 * `NVP_LAST_VIEWED_CALENDAR_DATE` is keyed PER VIEWED USER, so independence
 * (Rule 2) is structural: the caller derives `hasLastViewed` from that user's
 * OWN entry (`map[userID]`), and one user's entry can never reach another's
 * calendar. Precedence:
 *   - the viewed user's own last-viewed date, when present (restores both the
 *     signed-in user's and a friend's last-scrolled position);
 *   - otherwise the locally-navigated month, while it still belongs to the
 *     viewed user;
 *   - otherwise today (a user viewed for the first time since launch — their
 *     entry was cleared by the cold-launch reset).
 *
 * Pure and value-free so it can be unit-tested without `DataHandling`/`DateData`
 * dependencies; the caller maps the returned source to a concrete date.
 */
function selectCalendarVisibleSource(params: {
  hasLastViewed: boolean;
  localBelongsToViewedUser: boolean;
}): CalendarVisibleSource {
  if (params.hasLastViewed) {
    return 'lastViewed';
  }
  if (params.localBelongsToViewedUser) {
    return 'local';
  }
  return 'today';
}

export {
  computeLoadTarget,
  getCompactCalendarLoadTarget,
  selectCalendarVisibleSource,
};
export type {CalendarVisibleSource};
