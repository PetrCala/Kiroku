import {useMemo} from 'react';
import {DashPathEffect} from '@shopify/react-native-skia';
import {Bar, BaseChart, Line, useChartFont} from '@components/Charts/BaseChart';
import {
  roundTick,
  valueTicks,
} from '@components/Charts/BaseChart/axisFormatters';
import buildDateTicks from '@components/Charts/BaseChart/dateTicks';

type WeeklyAfBarsProps = {
  /** ISO-week labels, one per bar. Drives the x-axis order. */
  weeks: string[];
  /** Alcohol-free days per week (0–7), length === weeks.length. */
  afDays: number[];
  /** Comparison-period AF-days, parallel-indexed; omit to hide. */
  comparison?: number[];
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** When true, shows the BaseChart skeleton instead of the bars. */
  isLoading?: boolean;
};

type WeeklyAfRow = {x: number; y: number; cmp: number};

const COMPARISON_DASH: number[] = [4, 4];
/** A week has at most 7 days; pin the axis there so a full week is a full bar. */
const DAYS_PER_WEEK = 7;

/**
 * Alcohol-free days per week. Where the cumulative line only ever climbs, these
 * bars stand on their own: a drinking week is a short bar, an abstinent week is
 * a tall (up to 7) one, so the chart responds to both relapse and recovery. The
 * y-axis is pinned to 7 so bar height reads as "days out of the week".
 *
 * An optional dashed comparison line traces the previous period's weekly
 * AF-days. Callers zero-fill missing series upstream so the chart never ingests
 * NaN.
 */
function WeeklyAfBars({
  weeks,
  afDays,
  comparison,
  accessibilityLabel,
  emptyLabel,
  height,
  isLoading,
}: WeeklyAfBarsProps) {
  const axisFont = useChartFont();
  const showComparison =
    !!comparison && comparison.length === weeks.length && weeks.length > 0;

  const data = useMemo<WeeklyAfRow[]>(
    () =>
      weeks.map((w, i) => ({
        x: i,
        y: afDays[i] ?? 0,
        cmp: showComparison ? comparison?.[i] ?? 0 : 0,
      })),
    [weeks, afDays, comparison, showComparison],
  );

  const yKeys = useMemo<ReadonlyArray<'y' | 'cmp'>>(
    () => (showComparison ? ['y', 'cmp'] : ['y']),
    [showComparison],
  );

  const dateTicks = useMemo(
    () =>
      buildDateTicks({
        firstKey: weeks[0] ?? '',
        lastKey: weeks[weeks.length - 1] ?? '',
        length: weeks.length,
        unit: 'week',
      }),
    [weeks],
  );
  const yTicks = useMemo(() => valueTicks(DAYS_PER_WEEK), []);

  return (
    <BaseChart
      data={data}
      yKeys={yKeys}
      range="rolling8w"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      domainY={[0, DAYS_PER_WEEK]}
      axis={{
        font: axisFont,
        tickValues: {x: dateTicks.indices, y: yTicks},
        formatXLabel: dateTicks.labelFor,
        formatYLabel: roundTick,
      }}
      loading={isLoading}>
      {({points, chartBounds, theme}) => (
        <>
          <Bar
            points={points.y}
            chartBounds={chartBounds}
            color={theme.primaryFill}
            roundedCorners={{topLeft: 3, topRight: 3}}
          />
          {showComparison ? (
            <Line
              points={points.cmp}
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

export default WeeklyAfBars;
export type {WeeklyAfBarsProps};
