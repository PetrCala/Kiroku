import {useMemo} from 'react';
import {DashPathEffect} from '@shopify/react-native-skia';
import {
  Area,
  BaseChart,
  Line,
  useChartFont,
} from '@components/Charts/BaseChart';
import buildDateTicks from '@components/Charts/BaseChart/dateTicks';

type AfRateLinePoint = {date: string; rate: number};

type AfRateLineProps = {
  points: AfRateLinePoint[];
  /** Parallel-indexed comparison series; omit to hide. */
  comparisonPoints?: AfRateLinePoint[];
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** When true, shows the BaseChart skeleton instead of the line. */
  isLoading?: boolean;
};

type AfRateRow = {x: number; y: number; cmp: number};

const COMPARISON_DASH: number[] = [4, 4];
/** The rate is a 0–100 percentage, so the axis is fixed. */
const RATE_TICKS: number[] = [0, 25, 50, 75, 100];
/**
 * Gentle smoothing. `monotoneX` rounds off the daily stair-stepping of an
 * already-averaged series without overshooting past the pinned 0–100 domain or
 * inventing bumps between points (which `natural`/`cardinal` would).
 */
const CURVE_TYPE = 'monotoneX' as const;
/**
 * Morph the path on data changes so switching periods animates instead of
 * snapping to the next values. Both the line and its fill share this so they
 * move together.
 */
const LINE_ANIMATION = {type: 'timing', duration: 300} as const;

/** Format a rolling-rate y tick as a whole-number percentage. */
function pctTick(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Rolling alcohol-free rate (% of the trailing window that was alcohol-free).
 * Unlike the cumulative line, this curve falls during a drinking stretch and
 * rises during abstinence, so it reads as current momentum rather than an
 * ever-climbing total. A faint area under the line gives it weight; the axis
 * is pinned to 0–100 so the height is always comparable.
 *
 * An optional dashed comparison line traces the previous period's rate.
 */
function AfRateLine({
  points,
  comparisonPoints,
  accessibilityLabel,
  emptyLabel,
  height,
  isLoading,
}: AfRateLineProps) {
  const axisFont = useChartFont();
  const showComparison =
    !!comparisonPoints && comparisonPoints.length === points.length;

  const data = useMemo<AfRateRow[]>(
    () =>
      points.map((p, i) => ({
        x: i,
        y: p.rate,
        cmp: showComparison ? comparisonPoints?.[i]?.rate ?? 0 : 0,
      })),
    [points, comparisonPoints, showComparison],
  );

  const yKeys = useMemo<ReadonlyArray<'y' | 'cmp'>>(
    () => (showComparison ? ['y', 'cmp'] : ['y']),
    [showComparison],
  );

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

  return (
    <BaseChart
      data={data}
      yKeys={yKeys}
      range="allTime"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      domainY={[0, 100]}
      axis={{
        font: axisFont,
        tickValues: {x: dateTicks.indices, y: RATE_TICKS},
        formatXLabel: dateTicks.labelFor,
        formatYLabel: pctTick,
      }}
      loading={isLoading}>
      {({points: linePoints, chartBounds, theme}) => (
        <>
          <Area
            points={linePoints.y}
            y0={chartBounds.bottom}
            color={theme.bandFill}
            curveType={CURVE_TYPE}
            animate={LINE_ANIMATION}
          />
          <Line
            points={linePoints.y}
            color={theme.primaryStroke}
            strokeWidth={2}
            curveType={CURVE_TYPE}
            animate={LINE_ANIMATION}
          />
          {showComparison ? (
            <Line
              points={linePoints.cmp}
              color={theme.comparisonStroke}
              strokeWidth={1.5}
              curveType={CURVE_TYPE}
              animate={LINE_ANIMATION}>
              <DashPathEffect intervals={COMPARISON_DASH} />
            </Line>
          ) : null}
        </>
      )}
    </BaseChart>
  );
}

export default AfRateLine;
export type {AfRateLinePoint, AfRateLineProps};
