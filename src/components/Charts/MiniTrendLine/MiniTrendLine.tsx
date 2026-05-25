import {useMemo} from 'react';
import {Rect} from '@shopify/react-native-skia';
import {BaseChart, Line} from '@components/Charts/BaseChart';
import type {ChartDatum} from '@libs/Statistics';

type MiniTrendLineProps = {
  /** Weekly points oldest → newest. `x` is the ISO week label, `y` units. */
  points: ChartDatum[];
  /** 25th–75th percentile band over the same window. */
  band: {p25: number; p75: number};
  /** EWMA-smoothed series aligned to `points` by index. Optional. */
  ewma?: number[];
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
};

/**
 * Whoop-style mini trend: a translucent band-of-normal stripe with an
 * EWMA-smoothed line on top. The raw weekly values back the chart's x
 * domain so the line aligns to real week buckets, but only the smoothed
 * line is drawn — bars would compete with the Overview's heatmap above it.
 */
function MiniTrendLine({
  points,
  band,
  ewma,
  accessibilityLabel,
  emptyLabel,
  height,
}: MiniTrendLineProps) {
  const smoothed = useMemo<ChartDatum[]>(() => {
    if (!ewma || ewma.length !== points.length) {
      return points;
    }
    return points.map((point, i) => ({x: point.x, y: ewma[i]}));
  }, [ewma, points]);

  // Stretch the Y domain to include both the raw points and the band, so a
  // band that sits above every observed point still renders.
  const maxY = useMemo(() => {
    const values = [
      ...points.map(p => p.y),
      ...smoothed.map(p => p.y),
      band.p75,
    ];
    return Math.max(...values, 1);
  }, [points, smoothed, band.p75]);

  return (
    <BaseChart
      data={smoothed}
      range="rolling8w"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}
      hideAxes>
      {({points: chartPoints, chartBounds, theme}) => {
        const top = chartBounds.top;
        const bottom = chartBounds.bottom;
        const yFor = (value: number) =>
          top + (1 - value / maxY) * (bottom - top);
        const bandTopY = yFor(band.p75);
        const bandBottomY = yFor(band.p25);
        const bandHeight = Math.max(0, bandBottomY - bandTopY);

        return (
          <>
            {bandHeight > 0 ? (
              <Rect
                x={chartBounds.left}
                y={bandTopY}
                width={chartBounds.right - chartBounds.left}
                height={bandHeight}
                color={theme.bandFill}
              />
            ) : null}
            <Line
              points={chartPoints.y}
              color={theme.primaryStroke}
              strokeWidth={2}
              curveType="natural"
            />
          </>
        );
      }}
    </BaseChart>
  );
}

export default MiniTrendLine;
export type {MiniTrendLineProps};
