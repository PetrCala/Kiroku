import {sduFrom} from '@libs/Statistics/sdu';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import type {SessionEntry} from '@src/types/onyx/SessionEntries';

/**
 * Volume/ABV defaults per drink type, the shape of `CONST.DRINK_DEFAULTS`.
 * Passed as a parameter so the functions stay pure and a caller can supply
 * none (then no SDU can be computed for an entry without overrides).
 */
type DrinkDefaults = Partial<Record<DrinkKey, {ml: number; abv: number}>>;

/** The fields of an entry the unit math reads. */
type UnitEntry = Pick<SessionEntry, 'key' | 'count' | 'volume_ml' | 'abv'>;

/**
 * Units of one entry: `count` times the user's per-type factor
 * (`preferences.drinks_to_units`). An unknown key or a missing map counts 0.
 * This is the one place units are computed; the session screens, the
 * calendar and Statistics all go through it.
 */
function entryUnits(
  entry: Pick<SessionEntry, 'key' | 'count'>,
  drinksToUnits: DrinksToUnits | undefined,
): number {
  return entry.count * (drinksToUnits?.[entry.key] ?? 0);
}

/**
 * Standard drink units of one entry: grams of ethanol (`ml * abv * 0.789`)
 * over 10 g, times `count`. `volume_ml` and `abv` fall back to the per-type
 * defaults the caller passes (`CONST.DRINK_DEFAULTS` in the app), exactly as
 * Statistics v2 has always done (contributingGuides/STATISTICS_V2.md §3).
 * `undefined` when neither the entry nor the defaults supply both values.
 */
function entrySdu(
  entry: UnitEntry,
  drinkDefaults: DrinkDefaults | undefined,
): number | undefined {
  const defaults = drinkDefaults?.[entry.key];
  const ml = entry.volume_ml ?? defaults?.ml;
  const abv = entry.abv ?? defaults?.abv;
  if (ml === undefined || abv === undefined) {
    return undefined;
  }
  return sduFrom(ml, abv) * entry.count;
}

/** Sum of `entryUnits` over a list of entries. */
function sumEntryUnits(
  entries: ReadonlyArray<Pick<SessionEntry, 'key' | 'count'>>,
  drinksToUnits: DrinksToUnits | undefined,
): number {
  if (!drinksToUnits) {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    total += entryUnits(entry, drinksToUnits);
  }
  return total;
}

/** Sum of `count` over a list of entries (the number of drinks). */
function sumEntryCounts(
  entries: ReadonlyArray<Pick<SessionEntry, 'count'>>,
): number {
  let total = 0;
  for (const entry of entries) {
    total += entry.count;
  }
  return total;
}

export {entrySdu, entryUnits, sumEntryCounts, sumEntryUnits};
export type {DrinkDefaults};
