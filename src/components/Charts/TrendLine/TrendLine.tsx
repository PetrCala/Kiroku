import {useMemo} from 'react';
import {View} from 'react-native';
import {DashPathEffect, Rect} from '@shopify/react-native-skia';
import {BaseChart, Line} from '@components/Charts/BaseChart';
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
  /** P25 / P75 band; null when the underlying series is too short. */
  band?: {p25: number; p75: number} | null;
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** Fired with the ISO-week label of the tapped point (drill-down hook). */
  onWeekPress?: (isoWeek: string) => void;
  /** When true, shows the BaseChart skeleton instead of the trend chart. */
  isLoading?: boolean;
};

type TrendRow = {
  x: string;
  y: number;
  ewma: number;
  cmp: number;
};

const COMPARISON_DASH: number[] = [4, 4];

/**
 * Hero chart for the Trends tab. Composes:
 *   1. translucent P25–P75 "band of normal" stripe (Skia <Rect>),
 *   2. solid weekly-units line in the brand color,
 *   3. thinner EWMA line above (hidden when < 4 weeks),
 *   4. dashed muted-color comparison line (hidden when not requested).
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
  band,
  accessibilityLabel,
  emptyLabel,
  height,
  onWeekPress,
  isLoading,
}: TrendLineProps) {
  const showEwma = !!ewma && ewma.length === weeks.length;
  const showComparison =
    !!comparison && comparison.length === weeks.length && weeks.length > 0;

  const data = useMemo<TrendRow[]>(
    () =>
      weeks.map((w, i) => ({
        x: w,
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
    if (band && band.p75 > max) max = band.p75;
    return max;
  }, [data, band, showEwma, showComparison]);

  const hasTapTargets = !!onWeekPress && weeks.length > 0;

  const chart = (
    <BaseChart
      data={data}
      yKeys={yKeys}
      range="rolling8w"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      loading={isLoading}>
      {({points, chartBounds, theme}) => {
        const top = chartBounds.top;
        const bottom = chartBounds.bottom;
        const yFor = (value: number) =>
          top + (1 - value / maxY) * (bottom - top);

        let bandRect = null;
        if (band) {
          const bandTopY = yFor(band.p75);
          const bandBottomY = yFor(band.p25);
          const bandHeight = Math.max(0, bandBottomY - bandTopY);
          if (bandHeight > 0) {
            bandRect = (
              <Rect
                x={chartBounds.left}
                y={bandTopY}
                width={chartBounds.right - chartBounds.left}
                height={bandHeight}
                color={theme.bandFill}
              />
            );
          }
        }

        return (
          <>
            {bandRect}
            <Line
              points={points.y}
              color={theme.primaryStroke}
              strokeWidth={2}
            />
            {showEwma ? (
              <Line
                points={points.ewma}
                color={theme.primaryStroke}
                strokeWidth={1.5}
                opacity={0.6}
              />
            ) : null}
            {showComparison ? (
              <Line
                points={points.cmp}
                color={theme.comparisonStroke}
                strokeWidth={1.5}>
                <DashPathEffect intervals={COMPARISON_DASH} />
              </Line>
            ) : null}
          </>
        );
      }}
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
