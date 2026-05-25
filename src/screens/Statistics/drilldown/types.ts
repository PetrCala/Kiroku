import type {DrinkKey} from '@src/types/onyx/Drinks';

/**
 * A tap on any Statistics chart describes one bucket of the underlying
 * `DrinkEvent` stream. The drill-down sheet filters events to the events
 * (and sessions) that fall in that bucket.
 *
 * Most kinds are event-level — they map to a `DrinkEvent` predicate via
 * {@link bucketToFilter}. The two `session*Bin` kinds are session-level:
 * they're evaluated after events have been grouped into sessions, because
 * "drinks per session" and "session duration" aren't event attributes.
 */
type BucketDescriptor =
  | {kind: 'day'; date: string}
  | {kind: 'isoWeek'; isoWeek: string}
  | {kind: 'month'; month: string}
  | {kind: 'hour'; hour: number}
  | {kind: 'dow'; dow: number}
  | {kind: 'dowHour'; dow: number; hour: number}
  | {kind: 'drinkType'; drinkKey: DrinkKey}
  | {kind: 'isoWeekDrinkType'; isoWeek: string; drinkKey: DrinkKey}
  | {kind: 'sessionDrinkCountBin'; minDrinks: number; maxDrinks?: number}
  | {kind: 'sessionDurationBin'; minMinutes: number; maxMinutes?: number};

type BucketKind = BucketDescriptor['kind'];

export type {BucketDescriptor, BucketKind};
