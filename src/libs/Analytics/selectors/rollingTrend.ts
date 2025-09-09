import type {DayRollup, Point} from '@analytics/types';
import DateUtils from '@libs/DateUtils';
import CONST from '@src/CONST';
import {addDays, format, parse, subDays} from 'date-fns';

/**
 * Gets rolling trend data for the specified number of days.
 *
 * @param dayRows - The day rollups.
 * @param days - The number of days to include in the trend.
 * @returns The rolling trend data.
 */
function getRollingTrend(dayRows: DayRollup[], days = 28): Point[] {
  const now = new Date();
  const end = DateUtils.getLocalizedDay(
    now,
    undefined,
    CONST.DATE.FNS_FORMAT_STRING,
  );
  const endDate = parse(end, CONST.DATE.FNS_FORMAT_STRING, new Date());
  const startDate = subDays(endDate, days - 1);

  const byKey = new Map(dayRows.map(r => [r.dateKey, r.totalSdu]));
  const values: number[] = [];
  const labels: string[] = [];

  for (let i = 0; i < days; i++) {
    const currentDate = addDays(startDate, i);
    const key = format(currentDate, CONST.DATE.FNS_FORMAT_STRING);
    labels.push(key);
    values.push(byKey.get(key) ?? 0);
  }

  const avgSeries: Point[] = [];
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - 6);
    const slice = values.slice(from, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    avgSeries.push({x: labels[i], y: +avg.toFixed(2)});
  }

  return avgSeries;
}

// eslint-disable-next-line import/prefer-default-export
export {getRollingTrend};
