import {useMemo, useState} from 'react';
import {selectWeeklyBars} from '@libs/Statistics';
import type {SelectWeeklyBarsResult} from '@libs/Statistics';
import useStatisticsRollups from './useStatisticsRollups';

type UseWeeklyBarsOptions = {
  /** Number of weeks to include. Defaults to 8. */
  weeks?: number;
};

type UseWeeklyBarsReturn = {
  data: SelectWeeklyBarsResult;
  isLoading: boolean;
  isEmpty: boolean;
};

const EMPTY: SelectWeeklyBarsResult = {bars: [], band: {p25: 0, p75: 0}};

/**
 * The N-week (default 8) trend bar chart input, anchored to today's ISO
 * week (snapshotted once at mount). Also returns the 25/75-percentile band
 * that drives the Whoop-style "band of normal" overlay specified in the
 * design doc §3.
 */
function useWeeklyBars(options?: UseWeeklyBarsOptions): UseWeeklyBarsReturn {
  const {
    data: rollups,
    timezone,
    weekStartsOn,
    isLoading,
    isEmpty,
  } = useStatisticsRollups();
  const weeks = options?.weeks ?? 8;
  const [asOfDate] = useState(() => new Date());

  const data = useMemo<SelectWeeklyBarsResult>(() => {
    if (isLoading) {
      return EMPTY;
    }
    return selectWeeklyBars(rollups, {
      asOfDate,
      timezone,
      weekStartsOn,
      weeks,
    });
  }, [isLoading, rollups, asOfDate, timezone, weekStartsOn, weeks]);

  return {data, isLoading, isEmpty};
}

export default useWeeklyBars;
export type {UseWeeklyBarsOptions, UseWeeklyBarsReturn};
