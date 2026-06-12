import {useMemo} from 'react';
import {DashPathEffect} from '@shopify/react-native-skia';
import {BaseChart, Line, useChartFont} from '@components/Charts/BaseChart';
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
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** When true, shows the BaseChart skeleton instead of the line. */
  isLoading?: boolean;
};

type CumulativeRow = {x: number; y: number; cmp: number};

const COMPARISON_DASH: number[] = [4, 4];

/**
 * Cumulative AF-days line. `buildAfCumulativeSeries` accumulates across the
 * whole selected range without resetting at year boundaries, so the series
 * handed in is monotonically non-decreasing and the line only ever climbs
 * from the bottom-left to the top-right.
 */
function CumulativeLine({
  points,
  comparisonPoints,
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
        cmp: showComparison ? comparisonPoints?.[i]?.count ?? 0 : 0,
      })),
    [points, comparisonPoints, showComparison],
  );

  const yKeys = useMemo<ReadonlyArray<'y' | 'cmp'>>(
    () => (showComparison ? ['y', 'cmp'] : ['y']),
    [showComparison],
  );

  const maxCount = useMemo(() => {
    let max = 1;
    for (const row of data) {
      if (row.y > max) {
        max = row.y;
      }
      if (showComparison && row.cmp > max) {
        max = row.cmp;
      }
    }
    return max;
  }, [data, showComparison]);

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
      {({points: linePoints, theme}) => (
        <>
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
