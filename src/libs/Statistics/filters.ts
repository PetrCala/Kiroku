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

export {
  dateRange,
  drinkTypeSubset,
  excludeBlackouts,
  forUsers,
  weekdaysOnly,
  weekendsOnly,
};
