import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {EventFilter} from './aggregate';

/**
 * Inclusive on both ends. `startMs` and `endMs` are JavaScript milliseconds.
 */
function dateRange(startMs: number, endMs: number): EventFilter {
  return event => event.ts >= startMs && event.ts <= endMs;
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
  weekdaysOnly,
  weekendsOnly,
};
