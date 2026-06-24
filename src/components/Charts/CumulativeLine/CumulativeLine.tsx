import {useMemo} from 'react';
import {DashPathEffect} from '@shopify/react-native-skia';
import {
  Area,
  BaseChart,
  Line,
  useChartFont,
} from '@components/Charts/BaseChart';
import {
  roundTick,
  valueTicks,
} from '@components/Charts/BaseChart/axisFormatters';
import buildDateTicks from '@components/Charts/BaseChart/dateTicks';

type CumulativeLinePoint = {date: string; count: number};

type CumulativeLineProps = {
  points: CumulativeLinePoint[];
  /** Parallel-indexed comparison series; omit to hide. */
  comparisonPoints?: CumulativeLinePoint[];
  /**
   * Draw the "ideal pace" envelope — the count the line would hit if every
   * elapsed day were alcohol-free (i.e. `index + 1`). It rises as a straight
   * ramp to the top-right; the actual line rides below it, so the gap between
   * the two reads directly as "days you drank". Off by default.
   */
  showIdeal?: boolean;
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** When true, shows the BaseChart skeleton instead of the line. */
  isLoading?: boolean;
};

type CumulativeRow = {x: number; y: number; cmp: number; ideal: number};

const COMPARISON_DASH: number[] = [4, 4];

/**
 * Cumulative AF-days line. `buildAfCumulativeSeries` accumulates across the
 * whole selected range without resetting at year boundaries, so the series
 * handed in is monotonically non-decreasing and the line only ever climbs
 * from the bottom-left to the top-right.
 *
 * On its own that line is hard to read — a perfect period and a heavy-drinking
 * period both slope up, just at different angles. With `showIdeal` the chart
 * also fills the "if every day were alcohol-free" envelope behind the line, so
 * the empty wedge above the actual line is exactly the drinking days and the
 * picture finally moves with behaviour instead of only ever climbing.
 */
function CumulativeLine({
  points,
  comparisonPoints,
  showIdeal = false,
  accessibilityLabel,
  emptyLabel,
  height,
  isLoading,
}: CumulativeLineProps) {
  const axisFont = useChartFont();
  const showComparison =
    !!comparisonPoints && comparisonPoints.length === points.length;

  const data = useMemo<CumulativeRow[]>(
    () =>
      points.map((p, i) => ({
        x: i,
        y: p.count,
        cmp: showComparison ? (comparisonPoints?.[i]?.count ?? 0) : 0,
        // The most AF-days reachable by day `i` is `i + 1` (every day counts).
        ideal: i + 1,
      })),
    [points, comparisonPoints, showComparison],
  );

  const yKeys = useMemo<ReadonlyArray<'y' | 'cmp' | 'ideal'>>(() => {
    const keys: Array<'y' | 'cmp' | 'ideal'> = ['y'];
    if (showIdeal) keys.push('ideal');
    if (showComparison) keys.push('cmp');
    return keys;
  }, [showIdeal, showComparison]);

  const maxCount = useMemo(() => {
    let max = 1;
    for (const row of data) {
      if (row.y > max) {
        max = row.y;
      }
      if (showComparison && row.cmp > max) {
        max = row.cmp;
      }
      // The ideal ramp tops out at the day count, so it sets the ceiling.
      if (showIdeal && row.ideal > max) {
        max = row.ideal;
      }
    }
    return max;
  }, [data, showComparison, showIdeal]);

  const dateTicks = useMemo(
    () =>
      buildDateTicks({
        firstKey: points[0]?.date ?? '',
        lastKey: points[points.length - 1]?.date ?? '',
        length: points.length,
        unit: 'day',
      }),
    [points],
  );
  const yTicks = useMemo(() => valueTicks(maxCount), [maxCount]);

  return (
    <BaseChart
      data={data}
      yKeys={yKeys}
      range="allTime"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      axis={{
        font: axisFont,
        tickValues: {x: dateTicks.indices, y: yTicks},
        formatXLabel: dateTicks.labelFor,
        formatYLabel: roundTick,
      }}
      loading={isLoading}>
      {({points: linePoints, chartBounds, theme}) => (
        <>
          {showIdeal ? (
            <Area
              points={linePoints.ideal}
              y0={chartBounds.bottom}
              color={theme.bandFill}
              animate={{type: 'timing', duration: 200}}
            />
          ) : null}
          <Line
            points={linePoints.y}
            color={theme.primaryStroke}
            strokeWidth={2}
          />
          {showComparison ? (
            <Line
              points={linePoints.cmp}
              color={theme.comparisonStroke}
              strokeWidth={1.5}>
              <DashPathEffect intervals={COMPARISON_DASH} />
            </Line>
          ) : null}
        </>
      )}
    </BaseChart>
  );
}

export default CumulativeLine;
export type {CumulativeLinePoint, CumulativeLineProps};
