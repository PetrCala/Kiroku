import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type {Timestamp} from './OnyxCommon';

/** A timestamp of when this drink was recorded */
type DrinksTimestamp = Timestamp;

/** A drink identifier key */
type DrinkKey = DeepValueOf<typeof CONST.DRINKS.KEYS>;

/**
 * A single drink record. Either a legacy numeric count, or an object form that
 * can carry per-event `volume_ml` / `abv` overrides for SDU math. The numeric
 * arm stays valid so on-disk legacy data (and an interrupted migration) keeps
 * typechecking; reads must narrow via `DrinkEntryUtils.getDrinkCount`.
 */
type DrinkEntry =
  | number
  | {
      /** Number of drinks of this type recorded at this timestamp */
      count: number;
      /** Per-event volume override in millilitres */
      volume_ml?: number;
      /** Per-event ABV override as a fraction (e.g. 0.05 for 5%) */
      abv?: number;
    };

/** A collection of drink records, usually stored under a single timestamp */
type Drinks = Partial<Record<DrinkKey, DrinkEntry>>;

/** A list of timestamped drinks objects */
type DrinksList = Record<DrinksTimestamp, Drinks>;

export default Drinks;
export type {DrinkEntry, DrinkKey, DrinksList, DrinksTimestamp};
