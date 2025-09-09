import type {DrinkKey} from '@src/types/onyx';

type DayRollup = {
  userId: string;
  dateKey: string; // 'YYYY-MM-DD' in user TZ
  totalSdu: number;
  drinksCount: number;
  byType: Partial<Record<DrinkKey, number>>;
  firstTs?: string;
  lastTs?: string;
};

type Point = {x: string; y: number};
type HeatDay = {date: string; value: number};
type StackedPoint = {x: string; segments: Record<DrinkKey, number>};

export type {DayRollup, Point, HeatDay, StackedPoint};
