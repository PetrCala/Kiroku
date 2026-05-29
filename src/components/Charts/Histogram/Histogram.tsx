import {useMemo} from 'react';
import {Bar, BaseChart, useChartFont} from '@components/Charts/BaseChart';
import {
  roundTick,
  valueTicks,
} from '@components/Charts/BaseChart/axisFormatters';
import type {ChartDatum} from '@libs/Statistics';

type HistogramBin = {label: string; count: number};

type HistogramProps = {
  /**
   * Pre-binned data. The caller owns binning so each histogram can pick
   * intuitive fixed bins (e.g. drinks: 1, 2, 3, 4, 5+; duration: 0–30m,
   * 30–60m, 1–2h, 2–4h, 4h+).
   */
  bins: HistogramBin[];
  accessibilityLabel: string;
  /** Shown via `BaseChart` when every bin is zero. */
  emptyLabel?: string;
  height?: number;
  /** When true, shows the BaseChart skeleton instead of the bars. */
  isLoading?: boolean;
};

/**
 * Vertical bar histogram. Thin wrapper around `BaseChart` so concrete
 * histograms stay close to the data layer and far from Victory. Bars use the
 * primary fill color and rounded top corners to match `WeeklyBars`.
 */
function Histogram({
  bins,
  accessibilityLabel,
  emptyLabel,
  height,
  isLoading,
}: HistogramProps) {
  const axisFont = useChartFont();
  const data = useMemo<ChartDatum[]>(() => {
    if (bins.every(b => b.count === 0)) {
      return [];
    }
    return bins.map((b, i) => ({x: i, y: b.count}));
  }, [bins]);

  // One tick per bin (labels are short), and rounded count ticks on y.
  const xTicks = useMemo(() => bins.map((_, i) => i), [bins]);
  const yTicks = useMemo(
    () => valueTicks(Math.max(1, ...bins.map(b => b.count))),
    [bins],
  );

  return (
    <BaseChart
      data={data}
      range="allTime"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      axis={{
        font: axisFont,
        tickValues: {x: xTicks, y: yTicks},
        formatXLabel: index => bins[Math.round(index)]?.label ?? '',
        formatYLabel: roundTick,
      }}
      loading={isLoading}>
      {({points, chartBounds, theme}) => (
        <Bar
          points={points.y}
          chartBounds={chartBounds}
          color={theme.primaryFill}
          roundedCorners={{topLeft: 4, topRight: 4}}
        />
      )}
    </BaseChart>
  );
}

export default Histogram;
export type {HistogramBin, HistogramProps};
