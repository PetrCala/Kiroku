import type {DrinkKey} from './Drinks';

/** Persisted preset identifier for the Statistics date range selector. */
type RangePreset = 'W' | 'M' | '6M' | 'Y' | 'All' | 'Custom';

/**
 * User-tunable filter state for the Statistics tab navigator.
 *
 * `comparison` and `userIds` are intentionally NOT persisted — comparison
 * resets to `'none'` on every mount, and `userIds` is always
 * `[currentUserID]` until multi-user support ships.
 */
type StatisticsFilters = {
  /** Selected range preset. */
  preset: RangePreset;

  /** Inclusive start date for `Custom`, in `yyyy-MM-dd`. Only meaningful when `preset === 'Custom'`. */
  customStart?: string;

  /** Inclusive end date for `Custom`, in `yyyy-MM-dd`. Only meaningful when `preset === 'Custom'`. */
  customEnd?: string;

  /** Drink-type subset; empty array means "all drinks". Persisted as array (Onyx-friendly); hydrated into a Set at the provider boundary. */
  drinkTypeFilter: DrinkKey[];
};

export default StatisticsFilters;
export type {RangePreset};
