import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {EventFilter} from './aggregate';

/**
 * Inclusive on both ends. `startMs` and `endMs` are JavaScript milliseconds.
 * Windows by the session anchor (`start_time`), not the per-drink `ts`, so a
 * midnight-crossing session falls entirely in the window of the day it started.
 */
function dateRange(startMs: number, endMs: number): EventFilter {
  return event => event.anchorTs >= startMs && event.anchorTs <= endMs;
}

function drinkTypeSubset(
  keys: readonly DrinkKey[] | ReadonlySet<DrinkKey>,
): EventFilter {
  const set = keys instanceof Set ? keys : new Set<DrinkKey>(keys);
  return event => set.has(event.drinkKey);
}

const weekendsOnly: EventFilter = event => event.isWeekend;

const weekdaysOnly: EventFilter = event => !event.isWeekend;

const excludeBlackouts: EventFilter = event => !event.blackoutSession;

/**
 * Keep only events from live (real-time) sessions. Drops edit/manually-logged
 * sessions — and legacy untyped sessions — because their per-drink timestamps
 * are synthetic, so time-of-day buckets would be meaningless. A *finished* live
 * session still has `sessionType === 'live'`, so it is retained.
 */
const liveSessionsOnly: EventFilter = event =>
  event.sessionType === CONST.SESSION.TYPES.LIVE;

function forUsers(ids: readonly UserID[] | ReadonlySet<UserID>): EventFilter {
  const set = ids instanceof Set ? ids : new Set<UserID>(ids);
  return event => set.has(event.userId);
}

/**
 * AND together any number of filters. `undefined` entries are ignored so
 * callers can pass conditional filters without a wrapping ternary
 * (e.g. `composeFilters(dateRange(...), set.size ? drinkTypeSubset(set) : undefined)`).
 * Returns `undefined` if no real filters remain — `aggregate`'s `filter?`
 * param then short-circuits the per-event branch.
 */
function composeFilters(
  ...filters: Array<EventFilter | undefined>
): EventFilter | undefined {
  const active = filters.filter(
    (f): f is EventFilter => typeof f === 'function',
  );
  if (active.length === 0) {
    return undefined;
  }
  if (active.length === 1) {
    return active[0];
  }
  return event => {
    for (const f of active) {
      if (!f(event)) {
        return false;
      }
    }
    return true;
  };
}

export {
  composeFilters,
  dateRange,
  drinkTypeSubset,
  excludeBlackouts,
  forUsers,
  liveSessionsOnly,
  weekdaysOnly,
  weekendsOnly,
};
