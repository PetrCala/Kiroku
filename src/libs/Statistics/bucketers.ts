import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {Bucketer} from './aggregate';
import type {DrinkEvent} from './types';

/** Separator used by {@link composeBuckets} to flatten composite keys. */
const COMPOSITE_KEY_SEP = '';

const byHour: Bucketer<number> = event => event.localHour;

const byDow: Bucketer<number> = event => event.localDow;

const byDay: Bucketer<string> = event => event.localDay;

const byIsoWeek: Bucketer<string> = event => event.localIsoWeek;

const byMonth: Bucketer<string> = event => event.localMonth;

/**
 * Returns `yyyy-Qn` where n is 1..4. Derived from `localMonth` so the value
 * stays in the session timezone without re-deriving from `ts`.
 */
const byQuarter: Bucketer<string> = event => {
  const year = event.localMonth.slice(0, 4);
  const month = Number(event.localMonth.slice(5, 7));
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
};

const byYear: Bucketer<string> = event => event.localMonth.slice(0, 4);

const byDrinkKey: Bucketer<DrinkKey> = event => event.drinkKey;

const byBlackout: Bucketer<boolean> = event => event.blackoutSession;

const byUserId: Bucketer<UserID> = event => event.userId;

/**
 * Combine two bucketers into one whose key is the joined `${a}\x1f${b}`. The
 * literal spec sketch returns a tuple, but tuple identity defeats `Map`
 * grouping; serialising to a string preserves grouping while staying trivial
 * to split with `key.split('\x1f')`.
 */
function composeBuckets<A, B>(
  b1: Bucketer<A>,
  b2: Bucketer<B>,
): Bucketer<string> {
  return (event: DrinkEvent) =>
    `${String(b1(event))}${COMPOSITE_KEY_SEP}${String(b2(event))}`;
}

export {
  byBlackout,
  byDay,
  byDow,
  byDrinkKey,
  byHour,
  byIsoWeek,
  byMonth,
  byQuarter,
  byUserId,
  byYear,
  composeBuckets,
  COMPOSITE_KEY_SEP,
};
