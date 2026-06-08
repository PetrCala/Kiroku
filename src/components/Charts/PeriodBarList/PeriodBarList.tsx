import {BarList} from '@components/Charts/BarList';
import useLocalize from '@hooks/useLocalize';
import type {Granularity, SubPeriodPoint} from '@libs/Statistics/overview';

type PeriodBarListProps = {
  /** Gap-filled per-sub-period series from `buildSubPeriodSeries`. */
  points: SubPeriodPoint[];
  /** Drives label presentation (week buckets get a "Week of …" framing). */
  granularity: Granularity;
  accessibilityLabel: string;
  isLoading?: boolean;
  /**
   * Units from an in-progress live session, added onto the latest bucket so
   * the chart agrees with a hero total that already includes them.
   */
  liveExtraUnits?: number;
  barColor?: string;
};

// Wide enough for the localized "Week of May 5" label; other granularities
// (Mon / May / 2026) keep BarList's compact default.
const WEEK_LABEL_WIDTH = 96;

/**
 * Shared "units per sub-period" bar chart — the single rendering for both the
 * home stats block and the Statistics → Overview texture section, so the two
 * never drift. Week buckets are framed as "Week of <date>" (the descriptive
 * date comes from `buildSubPeriodSeries`; the localized prefix is added here).
 */
function PeriodBarList({
  points,
  granularity,
  accessibilityLabel,
  isLoading,
  liveExtraUnits = 0,
  barColor,
}: PeriodBarListProps) {
  const {translate} = useLocalize();
  const lastIndex = points.length - 1;

  const items = points.map((point, index) => ({
    label:
      granularity === 'week'
        ? translate('statistics.period.weekOf', {date: point.label})
        : point.label,
    value: index === lastIndex ? point.units + liveExtraUnits : point.units,
  }));

  return (
    <BarList
      items={items}
      accessibilityLabel={accessibilityLabel}
      isLoading={isLoading}
      barColor={barColor}
      labelWidth={granularity === 'week' ? WEEK_LABEL_WIDTH : undefined}
    />
  );
}

export default PeriodBarList;
export type {PeriodBarListProps};
