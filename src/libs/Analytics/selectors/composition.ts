import type {DayRollup, StackedPoint} from '@analytics/types';
import type {DrinkKey, Drinks} from '@src/types/onyx';
import CONST from '@src/CONST';
import {parse, startOfWeek, subDays} from 'date-fns';

/**
 * Gets stacked weekly data by drink type.
 *
 * @param dayRows - The day rollups.
 * @param weeks - The number of weeks to include.
 * @returns The stacked weekly data by drink type.
 */
function getByTypeStackedWeekly(
  dayRows: DayRollup[],
  weeks = 8,
): StackedPoint[] {
  // Handle empty or invalid input
  if (!Array.isArray(dayRows) || dayRows.length === 0) {
    return [];
  }

  const bucket = new Map<string, Drinks>();

  for (const r of dayRows) {
    const d = parse(r.dateKey, CONST.DATE.FNS_FORMAT_STRING, new Date());

    // Skip invalid dates
    if (!Number.isNaN(d.getTime())) {
      const weekNumber = getWeekNumber(d);
      const year = d.getFullYear();
      const wKey = `${weekNumber}-${year}`;

      const acc = bucket.get(wKey) ?? {};
      for (const [k, v] of Object.entries(r.byType)) {
        const drinkKey = k as DrinkKey;
        const value = v ?? 0;

        // Only add the drink key if it has a non-zero value
        if (value > 0) {
          acc[drinkKey] = (acc[drinkKey] ?? 0) + value;
        }
      }
      bucket.set(wKey, acc);
    }
  }

  const now = new Date();
  const endWeek = startOfWeek(now, {weekStartsOn: CONST.WEEK_STARTS_ON});
  const keys: string[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const d = subDays(endWeek, i * 7);

    // Validate generated date
    if (!Number.isNaN(d.getTime())) {
      const weekNumber = getWeekNumber(d);
      const year = d.getFullYear();
      keys.push(`${weekNumber}-${year}`);
    }
  }

  // If no valid keys were generated, create a fallback
  if (keys.length === 0) {
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();
    keys.push(`${currentWeek}-${currentYear}`);
  }

  return keys.map(k => {
    const weekData = bucket.get(k);
    const segments = toFixed(weekData);

    // If all drink units are empty, return a single entry with 0 for one drink type
    // This ensures the chart doesn't break when there's no data
    if (Object.keys(segments).length === 0) {
      return {
        x: k,
        segments: {[CONST.DRINKS.KEYS.OTHER]: 0} as Record<DrinkKey, number>,
      };
    }

    return {
      x: k,
      segments: segments as Record<DrinkKey, number>,
    };
  });
}

/**
 * Gets the week number for a given date.
 */
function getWeekNumber(date: Date): number {
  // Validate date before processing
  if (Number.isNaN(date.getTime())) {
    return 1; // Return week 1 as fallback
  }

  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

/**
 * Rounds all values in a drink record to 2 decimal places.
 * Only includes drink keys that have non-zero values.
 */
function toFixed(obj?: Drinks): Drinks {
  if (!obj) {
    return {};
  }

  const result: Drinks = {};

  for (const [key, value] of Object.entries(obj)) {
    const drinkKey = key as DrinkKey;
    const roundedValue = +(value ?? 0).toFixed(2);

    // Only include the drink key if it has a non-zero value
    if (roundedValue > 0) {
      result[drinkKey] = roundedValue;
    }
  }

  return result;
}

// eslint-disable-next-line import/prefer-default-export
export {getByTypeStackedWeekly};
