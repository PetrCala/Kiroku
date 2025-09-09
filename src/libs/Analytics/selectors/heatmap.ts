import type {DayRollup, HeatDay} from '@analytics/types';
import DateUtils from '@libs/DateUtils';
import CONST from '@src/CONST';
import {addDays, format, parse, subDays} from 'date-fns';

/**
 * Gets heatmap data for the specified number of days.
 *
 * @param dayRows - The day rollups.
 * @param days - The number of days to include in the heatmap.
 * @returns The heatmap data.
 */
function getHeatmapDays(dayRows: DayRollup[], days = 90): HeatDay[] {
  const now = new Date();
  const end = DateUtils.getLocalizedDay(
    now,
    undefined,
    CONST.DATE.FNS_FORMAT_STRING,
  );
  const endDate = parse(end, CONST.DATE.FNS_FORMAT_STRING, new Date());
  const startDate = subDays(endDate, days - 1);

  const map = new Map(dayRows.map(r => [r.dateKey, r.totalSdu]));
  const out: HeatDay[] = [];

  for (let i = 0; i < days; i++) {
    const currentDate = addDays(startDate, i);
    const key = format(currentDate, CONST.DATE.FNS_FORMAT_STRING);
    out.push({date: key, value: +(map.get(key) ?? 0).toFixed(2)});
  }

  return out;
}

// eslint-disable-next-line import/prefer-default-export
export {getHeatmapDays};
