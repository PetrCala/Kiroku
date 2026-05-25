import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {RangePreset} from '@src/types/onyx/StatisticsFilters';

type Comparison = 'none' | 'previous-period' | 'previous-year';

type Range = {
  start: Date;
  end: Date;
  preset: RangePreset;
};

type SetRangeInput =
  | {preset: Exclude<RangePreset, 'Custom'>}
  | {preset: 'Custom'; start: Date; end: Date};

type StatsContextValue = {
  range: Range;
  setRange: (next: SetRangeInput) => void;

  comparison: Comparison;
  setComparison: (next: Comparison) => void;

  /** Empty Set means "all drink types". */
  drinkTypeFilter: ReadonlySet<DrinkKey>;
  setDrinkTypeFilter: (next: ReadonlySet<DrinkKey>) => void;

  userIds: readonly UserID[];
  setUserIds: (next: readonly UserID[]) => void;
};

export type {Comparison, Range, RangePreset, SetRangeInput, StatsContextValue};
