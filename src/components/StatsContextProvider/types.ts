import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {RangePreset} from '@src/types/onyx/StatisticsFilters';

type Comparison = 'none' | 'previous-period' | 'previous-year';

type Range = {
  start: Date;
  end: Date;
  preset: RangePreset;
  /** `0` = current period, negative = N periods in the past. */
  offset: number;
  /** Whether the preset supports prev/next navigation (false for `All`/`Custom`). */
  isPageable: boolean;
  /** Whether stepping one period back stays within the user's recorded history. */
  canGoPrev: boolean;
  /** Whether a more recent period exists (i.e. `offset < 0`). */
  canGoNext: boolean;
  /** Whether the window is the current (latest) period. */
  isLatest: boolean;
};

type SetRangeInput =
  | {preset: Exclude<RangePreset, 'Custom'>}
  | {preset: 'Custom'; start: Date; end: Date};

type StatsContextValue = {
  range: Range;
  /** Calendar-aligned previous-period window, or null when comparison is off. */
  comparisonRange: {start: Date; end: Date} | null;
  setRange: (next: SetRangeInput) => void;
  goToPreviousPeriod: () => void;
  goToNextPeriod: () => void;
  goToLatest: () => void;

  comparison: Comparison;
  setComparison: (next: Comparison) => void;

  /** Empty Set means "all drink types". */
  drinkTypeFilter: ReadonlySet<DrinkKey>;
  setDrinkTypeFilter: (next: ReadonlySet<DrinkKey>) => void;

  userIds: readonly UserID[];
  setUserIds: (next: readonly UserID[]) => void;
};

export type {Comparison, Range, RangePreset, SetRangeInput, StatsContextValue};
