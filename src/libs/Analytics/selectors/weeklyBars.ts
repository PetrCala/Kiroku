import type {DayRollup, Point} from '@analytics/types';
import DateUtils from '@libs/DateUtils';
import CONST from '@src/CONST';
import {addDays, format, parse, subDays} from 'date-fns';

/**
 * Gets weekly bar data for the last 7 days.
 *
 * @param dayRows - The day rollups.
 * @param end - The end date for the weekly bars.
 * @returns The weekly bar data.
 */
function getWeeklyBars(dayRows: DayRollup[], end: Date = new Date()): Point[] {
  const endKey = DateUtils.getLocalizedDay(
    end,
    undefined,
    CONST.DATE.FNS_FORMAT_STRING,
  );
  const endDate = parse(endKey, CONST.DATE.FNS_FORMAT_STRING, new Date());
  const startDate = subDays(endDate, 6);

  const map = new Map(dayRows.map(r => [r.dateKey, r.totalSdu]));
  const out: Point[] = [];

  for (let i = 0; i < 7; i++) {
    const currentDate = addDays(startDate, i);
    const day = format(currentDate, CONST.DATE.FNS_FORMAT_STRING);
    out.push({x: day, y: +(map.get(day) ?? 0).toFixed(2)});
  }

  return out;
}

// eslint-disable-next-line import/prefer-default-export
export {getWeeklyBars};
