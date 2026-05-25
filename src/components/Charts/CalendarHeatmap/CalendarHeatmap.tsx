import {useMemo, useState} from 'react';
import {View} from 'react-native';
import {Canvas, RoundedRect} from '@shopify/react-native-skia';
import {useChartTheme} from '@components/Charts/BaseChart';
import type {HeatmapCell} from '@libs/Statistics';

type CalendarHeatmapProps = {
  cells: HeatmapCell[];
  accessibilityLabel: string;
  /** v1 wires the prop; no-op until Tier 3 drill-down lands. */
  onDayPress?: (cell: HeatmapCell) => void;
  /** Pixel gap between cells. Default 2. */
  gap?: number;
};

/**
 * Monthly heatmap drawn directly with Skia. One rounded cell per day,
 * color intensity from the theme's intensityRamp (yellow → orange,
 * never red — design doc §3). Visually invisible per-day View overlays
 * carry accessibilityLabels for screen readers since Skia draws to
 * canvas with no native a11y handles.
 */
function CalendarHeatmap({
  cells,
  accessibilityLabel,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- v2 hook
  onDayPress,
  gap = 2,
}: CalendarHeatmapProps) {
  const [width, setWidth] = useState(0);
  const theme = useChartTheme();

  const layout = useMemo(() => {
    if (cells.length === 0) {
      return {firstDayCol: 0, rows: 0};
    }
    const first = new Date(`${cells[0].dateKey}T00:00:00Z`);
    const firstDayCol = first.getUTCDay();
    const rows = Math.ceil((firstDayCol + cells.length) / 7);
    return {firstDayCol, rows};
  }, [cells]);

  const cellSize = width > 0 ? Math.floor(width / 7) : 0;
  const innerSize = Math.max(0, cellSize - gap);
  const height = layout.rows * cellSize;

  return (
    <View
      style={{height: height || 8, width: '100%'}}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={accessibilityLabel}>
      {cellSize > 0 ? (
        <>
          <Canvas style={{width, height, position: 'absolute'}}>
            {cells.map((cell, i) => {
              if (cell.isFuture) {
                return null;
              }
              const idx = layout.firstDayCol + i;
              const col = idx % 7;
              const row = Math.floor(idx / 7);
              const x = col * cellSize + gap / 2;
              const y = row * cellSize + gap / 2;
              return (
                <RoundedRect
                  key={cell.dateKey}
                  x={x}
                  y={y}
                  width={innerSize}
                  height={innerSize}
                  r={3}
                  color={theme.intensityRamp[cell.intensity]}
                />
              );
            })}
          </Canvas>
          {cells.map((cell, i) => {
            const idx = layout.firstDayCol + i;
            const col = idx % 7;
            const row = Math.floor(idx / 7);
            const a11yLabel = cell.isFuture
              ? `${cell.dateKey}, upcoming`
              : `${cell.dateKey}, ${cell.totalSdu} units`;
            return (
              <View
                key={`a11y-${cell.dateKey}`}
                accessible
                accessibilityLabel={a11yLabel}
                accessibilityRole="text"
                style={{
                  position: 'absolute',
                  left: col * cellSize,
                  top: row * cellSize,
                  width: cellSize,
                  height: cellSize,
                }}
              />
            );
          })}
        </>
      ) : null}
    </View>
  );
}

export default CalendarHeatmap;
export type {CalendarHeatmapProps};
