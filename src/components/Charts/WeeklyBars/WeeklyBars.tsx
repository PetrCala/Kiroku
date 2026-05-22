import {useMemo} from 'react';
import {Rect} from '@shopify/react-native-skia';
import {Bar, BaseChart} from '@components/Charts/BaseChart';
import type {ChartDatum, WeekRollup} from '@libs/Statistics';

type WeeklyBarsProps = {
  bars: WeekRollup[];
  /** 25th–75th percentile band of the weekly distribution. */
  band: {p25: number; p75: number};
  accessibilityLabel: string;
  emptyLabel?: string;
  height?: number;
  /** Fires when a bar is tapped. v1 wires this prop but doesn't yet
   *  render per-bar touchables — Tier 2 detail screens will. */
  onWeekPress?: (week: WeekRollup) => void;
};

/**
 * Weekly bar chart with a translucent "band of normal" stripe between p25
 * and p75 of the weekly distribution (Whoop-style). The band is purely
 * self-referential — no clinical thresholds, no judgment.
 *
 * Bars are bucketed by ISO week. Empty data short-circuits to
 * `BaseChart.emptyLabel`.
 */
function WeeklyBars({
  bars,
  band,
  accessibilityLabel,
  emptyLabel,
  height,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- v2 hook
  onWeekPress,
}: WeeklyBarsProps) {
  const data = useMemo<ChartDatum[]>(
    () => bars.map(b => ({x: b.isoWeek, y: b.totalSdu})),
    [bars],
  );

  // Max Y for the manual band-pixel mapping below. Include p75 so a sparse
  // dataset where every bar < p75 still draws the band correctly.
  const maxY = useMemo(() => {
    const max = Math.max(...data.map(d => d.y), band.p75, 1);
    return max;
  }, [data, band.p75]);

  return (
    <BaseChart
      data={data}
      range="rolling8w"
      accessibilityLabel={accessibilityLabel}
      emptyLabel={emptyLabel}
      height={height}>
      {({points, chartBounds, theme}) => {
        // Map p25/p75 data units to pixel y, mirroring Victory's default
        // [0, maxY] domain. Approximate but stable for v1 — refine in
        // Phase D if/when we expose Victory's y-scale via the render ctx.
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
            <Bar
              points={points.y}
              chartBounds={chartBounds}
              color={theme.primaryFill}
              roundedCorners={{topLeft: 4, topRight: 4}}
            />
          </>
        );
      }}
    </BaseChart>
  );
}

export default WeeklyBars;
export type {WeeklyBarsProps};
