import {useMemo, useState} from 'react';
import {selectCalendarHeatmap} from '@libs/Statistics';
import type {HeatmapCell} from '@libs/Statistics';
import useStatisticsRollups from './useStatisticsRollups';

type UseCalendarHeatmapOptions = {
  /** Any timestamp within the target month. Defaults to "now" at mount. */
  monthAnchor?: Date;
};

type UseCalendarHeatmapReturn = {
  data: HeatmapCell[];
  isLoading: boolean;
  isEmpty: boolean;
};

/**
 * Produces one HeatmapCell per day of the month containing `monthAnchor`
 * (or the current month if omitted). The returned cells always cover the
 * whole month — empty days produce zero-SDU cells, not gaps.
 */
function useCalendarHeatmap(
  options?: UseCalendarHeatmapOptions,
): UseCalendarHeatmapReturn {
  const {data: rollups, timezone, isLoading, isEmpty} = useStatisticsRollups();
  const [defaultAnchor] = useState(() => new Date());
  const monthAnchor = options?.monthAnchor ?? defaultAnchor;

  const data = useMemo<HeatmapCell[]>(() => {
    if (isLoading) {
      return [];
    }
    return selectCalendarHeatmap(rollups, {monthAnchor, timezone});
  }, [isLoading, rollups, monthAnchor, timezone]);

  return {data, isLoading, isEmpty};
}

export default useCalendarHeatmap;
export type {UseCalendarHeatmapOptions, UseCalendarHeatmapReturn};
