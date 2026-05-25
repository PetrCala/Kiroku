import type {DrinkEvent, EventFilter} from '@libs/Statistics';
import type {BucketDescriptor} from './types';

type SessionStats = {
  drinkCount: number;
  durationMin: number | undefined;
};

type SessionFilter = (stats: SessionStats) => boolean;

const ALWAYS_TRUE: EventFilter = () => true;
const ALWAYS_TRUE_SESSION: SessionFilter = () => true;

/**
 * Predicate over individual `DrinkEvent`s. Returns `ALWAYS_TRUE` for the two
 * session-level bin kinds — those are handled by {@link bucketToSessionFilter}
 * after events have been grouped into sessions.
 */
function bucketToFilter(bucket: BucketDescriptor): EventFilter {
  switch (bucket.kind) {
    case 'day':
      return (e: DrinkEvent) => e.localDay === bucket.date;
    case 'isoWeek':
      return (e: DrinkEvent) => e.localIsoWeek === bucket.isoWeek;
    case 'month':
      return (e: DrinkEvent) => e.localMonth === bucket.month;
    case 'hour':
      return (e: DrinkEvent) => e.localHour === bucket.hour;
    case 'dow':
      return (e: DrinkEvent) => e.localDow === bucket.dow;
    case 'dowHour':
      return (e: DrinkEvent) =>
        e.localDow === bucket.dow && e.localHour === bucket.hour;
    case 'drinkType':
      return (e: DrinkEvent) => e.drinkKey === bucket.drinkKey;
    case 'isoWeekDrinkType':
      return (e: DrinkEvent) =>
        e.localIsoWeek === bucket.isoWeek && e.drinkKey === bucket.drinkKey;
    case 'sessionDrinkCountBin':
    case 'sessionDurationBin':
    default:
      return ALWAYS_TRUE;
  }
}

/**
 * Predicate over session-level summary stats. Returns `ALWAYS_TRUE_SESSION`
 * for event-level buckets — those are handled by {@link bucketToFilter}.
 *
 * For `sessionDurationBin`, sessions whose duration is unknown (`undefined`,
 * e.g. ongoing or never-ended) are excluded from any duration bucket: the user
 * tapped "0–30m" expecting to see actual short sessions, not unknowns.
 */
function bucketToSessionFilter(bucket: BucketDescriptor): SessionFilter {
  switch (bucket.kind) {
    case 'sessionDrinkCountBin': {
      const {minDrinks, maxDrinks} = bucket;
      return ({drinkCount}) => {
        if (drinkCount < minDrinks) {
          return false;
        }
        if (maxDrinks !== undefined && drinkCount >= maxDrinks) {
          return false;
        }
        return true;
      };
    }
    case 'sessionDurationBin': {
      const {minMinutes, maxMinutes} = bucket;
      return ({durationMin}) => {
        if (durationMin === undefined || !Number.isFinite(durationMin)) {
          return false;
        }
        if (durationMin < minMinutes) {
          return false;
        }
        if (maxMinutes !== undefined && durationMin >= maxMinutes) {
          return false;
        }
        return true;
      };
    }
    case 'day':
    case 'isoWeek':
    case 'month':
    case 'hour':
    case 'dow':
    case 'dowHour':
    case 'drinkType':
    case 'isoWeekDrinkType':
    default:
      return ALWAYS_TRUE_SESSION;
  }
}

export {bucketToFilter, bucketToSessionFilter};
export type {SessionFilter, SessionStats};
