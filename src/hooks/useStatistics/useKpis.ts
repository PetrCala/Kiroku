import {useMemo, useState} from 'react';
import {selectKpis} from '@libs/Statistics';
import type {KpiValue} from '@libs/Statistics';
import useStatisticsRollups from './useStatisticsRollups';

type UseKpisReturn = {
  data: KpiValue[];
  isLoading: boolean;
  isEmpty: boolean;
};

/**
 * The four v1 summary-card KPIs: alcohol-free days this month, sessions
 * this week (+ delta), avg units per session (rolling 30d), and total
 * units this week (+ delta).
 *
 * `asOfDate` is snapshotted once at mount so the memo stays warm across
 * unrelated re-renders. A user who keeps the stats screen open across
 * midnight sees a stale view until they navigate away — accepted v1
 * trade-off.
 */
function useKpis(): UseKpisReturn {
  const {
    data: rollups,
    sessionCountsByDay,
    timezone,
    weekStartsOn,
    isLoading,
    isEmpty,
  } = useStatisticsRollups();
  const [asOfDate] = useState(() => new Date());

  const data = useMemo<KpiValue[]>(() => {
    if (isLoading) {
      return [];
    }
    return selectKpis(rollups, sessionCountsByDay, {
      asOfDate,
      timezone,
      weekStartsOn,
    });
  }, [
    isLoading,
    rollups,
    sessionCountsByDay,
    asOfDate,
    timezone,
    weekStartsOn,
  ]);

  return {data, isLoading, isEmpty};
}

export default useKpis;
export type {UseKpisReturn};
