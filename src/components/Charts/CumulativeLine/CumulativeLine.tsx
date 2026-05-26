import {useMemo} from 'react';
import {DashPathEffect} from '@shopify/react-native-skia';
import {BaseChart, Line} from '@components/Charts/BaseChart';

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

type CumulativeRow = {x: string; y: number; cmp: number};

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
  const showComparison =
    !!comparisonPoints && comparisonPoints.length === points.length;

  const data = useMemo<CumulativeRow[]>(
    () =>
      points.map((p, i) => ({
        x: p.date,
        y: p.count,
        cmp: showComparison ? comparisonPoints?.[i]?.count ?? 0 : 0,
      })),
    [points, comparisonPoints, showComparison],
  );

  const yKeys = useMemo<ReadonlyArray<'y' | 'cmp'>>(
    () => (showComparison ? ['y', 'cmp'] : ['y']),
    [showComparison],
  );

  return (
    <BaseChart
      data={data}
      yKeys={yKeys}
      range="allTime"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
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
