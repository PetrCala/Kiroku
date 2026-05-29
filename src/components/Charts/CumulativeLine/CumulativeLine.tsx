import {useMemo} from 'react';
import {DashPathEffect} from '@shopify/react-native-skia';
import {BaseChart, Line, useChartFont} from '@components/Charts/BaseChart';
import {
  formatDayTick,
  roundTick,
  tickIndices,
  valueTicks,
} from '@components/Charts/BaseChart/axisFormatters';

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
 * Cumulative AF-days line. Resets are handled upstream by
 * `buildAfYtdSeries` (returns 0 on Jan 1), so the chart just plots whatever
 * it's handed — including the reset, which surfaces as a downward step.
 * That step is the only time the line goes down; within a calendar year it
 * is monotonically non-decreasing.
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

  const xTicks = useMemo(() => tickIndices(points.length), [points.length]);
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
        tickValues: {x: xTicks, y: yTicks},
        formatXLabel: index =>
          formatDayTick(points[Math.round(index)]?.date ?? ''),
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
