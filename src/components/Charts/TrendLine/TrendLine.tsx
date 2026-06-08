import {useMemo} from 'react';
import {View} from 'react-native';
import {DashPathEffect} from '@shopify/react-native-skia';
import {Bar, BaseChart, Line, useChartFont} from '@components/Charts/BaseChart';
import {
  formatWeekTick,
  roundTick,
  tickIndices,
  valueTicks,
} from '@components/Charts/BaseChart/axisFormatters';
import {PressableWithoutFeedback} from '@components/Pressable';

type TrendLineProps = {
  /** ISO-week labels, one per data point. Drives the chart's x-axis order. */
  weeks: string[];
  /** Raw weekly units, length === weeks.length. */
  units: number[];
  /** Smoothed EWMA series; omit to hide the overlay (sparse data). */
  ewma?: number[];
  /** Comparison-period units, parallel-indexed; omit to hide. */
  comparison?: number[];
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** Fired with the ISO-week label of the tapped point (drill-down hook). */
  onWeekPress?: (isoWeek: string) => void;
  /** When true, shows the BaseChart skeleton instead of the trend chart. */
  isLoading?: boolean;
};

type TrendRow = {
  /** Week index (0-based); the real ISO-week label is resolved at format time. */
  x: number;
  y: number;
  ewma: number;
  cmp: number;
};

const COMPARISON_DASH: number[] = [4, 4];

/**
 * Hero chart for the Trends tab. Composes:
 *   1. faint weekly-units bars — the raw "what happened each week",
 *   2. a deeper-amber EWMA trend line on top — the prominent story line
 *      (hidden when < 4 weeks of data, leaving just the bars),
 *   3. a dashed muted-color comparison line (hidden when not requested).
 *
 * Every yKey present on `data` rows must be a real number; callers zero-fill
 * missing series upstream (in `useTrendsTabData`) so the underlying chart
 * doesn't ingest NaN.
 */
const MIN_TAP_TARGET = 44;

function TrendLine({
  weeks,
  units,
  ewma,
  comparison,
  accessibilityLabel,
  emptyLabel,
  height,
  onWeekPress,
  isLoading,
}: TrendLineProps) {
  const axisFont = useChartFont();
  const showEwma = !!ewma && ewma.length === weeks.length;
  const showComparison =
    !!comparison && comparison.length === weeks.length && weeks.length > 0;

  const data = useMemo<TrendRow[]>(
    () =>
      weeks.map((w, i) => ({
        x: i,
        y: units[i] ?? 0,
        ewma: showEwma ? ewma?.[i] ?? 0 : 0,
        cmp: showComparison ? comparison?.[i] ?? 0 : 0,
      })),
    [weeks, units, ewma, comparison, showEwma, showComparison],
  );

  const yKeys = useMemo<ReadonlyArray<'y' | 'ewma' | 'cmp'>>(() => {
    const keys: Array<'y' | 'ewma' | 'cmp'> = ['y'];
    if (showEwma) keys.push('ewma');
    if (showComparison) keys.push('cmp');
    return keys;
  }, [showEwma, showComparison]);

  const maxY = useMemo(() => {
    let max = 1;
    for (const row of data) {
      if (row.y > max) max = row.y;
      if (showEwma && row.ewma > max) max = row.ewma;
      if (showComparison && row.cmp > max) max = row.cmp;
    }
    return max;
  }, [data, showEwma, showComparison]);

  const xTicks = useMemo(() => tickIndices(weeks.length), [weeks.length]);
  const yTicks = useMemo(() => valueTicks(maxY), [maxY]);

  const hasTapTargets = !!onWeekPress && weeks.length > 0;

  const chart = (
    <BaseChart
      data={data}
      yKeys={yKeys}
      range="rolling8w"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      axis={{
        font: axisFont,
        tickValues: {x: xTicks, y: yTicks},
        formatXLabel: index => formatWeekTick(weeks[Math.round(index)] ?? ''),
        formatYLabel: roundTick,
      }}
      loading={isLoading}>
      {({points, chartBounds, theme}) => (
        <>
          <Bar
            points={points.y}
            chartBounds={chartBounds}
            color={theme.barFill}
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
          {showEwma ? (
            <Line
              points={points.ewma}
              color={theme.trendStroke}
              strokeWidth={2.6}
            />
          ) : null}
        </>
      )}
    </BaseChart>
  );

  if (!hasTapTargets) {
    return chart;
  }

  return (
    <View>
      {chart}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
        }}>
        {weeks.map(week => (
          <PressableWithoutFeedback
            key={week}
            accessibilityRole="button"
            accessibilityLabel={week}
            onPress={() => onWeekPress?.(week)}
            style={{flex: 1, minWidth: MIN_TAP_TARGET}}
          />
        ))}
      </View>
    </View>
  );
}

export default TrendLine;
export type {TrendLineProps};
