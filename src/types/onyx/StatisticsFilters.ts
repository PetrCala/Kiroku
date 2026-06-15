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

  /**
   * The pageable preset that was active when the user switched to `Custom`.
   * Powers the "revert to previous preset" button. Only meaningful when
   * `preset === 'Custom'`; cleared on any switch back to a preset.
   */
  presetBeforeCustom?: Exclude<RangePreset, 'Custom'>;

  /** Drink-type subset; empty array means "all drinks". Persisted as array (Onyx-friendly); hydrated into a Set at the provider boundary. */
  drinkTypeFilter: DrinkKey[];

  /**
   * Restrict the time-of-day charts (Patterns tab) to live sessions only,
   * excluding manually-logged sessions whose timestamps are synthetic.
   * `undefined` hydrates as `true` (default-on) at the provider boundary.
   */
  liveOnly?: boolean;
};

export default StatisticsFilters;
export type {RangePreset};
