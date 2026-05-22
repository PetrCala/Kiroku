import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {UserID} from '@src/types/onyx/OnyxCommon';

type DayRollup = {
  userId: UserID;
  dateKey: string;
  totalSdu: number;
  drinksCount: number;
  byType: Partial<Record<DrinkKey, number>>;
};

type WeekRollup = {
  userId: UserID;
  isoYear: number;
  isoWeek: number;
  weekStartDate: string;
  totalSdu: number;
  drinksCount: number;
  alcoholFreeDays: number;
};

type ChartDatum = {x: string | number; y: number};

type ChartRange = 'week' | 'month' | 'rolling30' | 'rolling8w' | 'allTime';

type HeatmapCell = {
  dateKey: string;
  totalSdu: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

type KpiDelta = {
  value: number;
  direction: 'up' | 'down' | 'flat';
  comparisonKey: 'vsLastWeek' | 'vsLastMonth';
};

type KpiKey =
  | 'alcoholFreeDays'
  | 'sessionsThisWeek'
  | 'avgUnitsPerSession'
  | 'totalUnitsThisWeek';

type KpiValue = {
  key: KpiKey;
  value: number | string;
  unit?: string;
  delta?: KpiDelta;
};

export type {
  DayRollup,
  WeekRollup,
  ChartDatum,
  ChartRange,
  HeatmapCell,
  KpiDelta,
  KpiKey,
  KpiValue,
};
