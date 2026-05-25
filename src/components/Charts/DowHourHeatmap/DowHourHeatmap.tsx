import {useMemo, useState} from 'react';
import {View} from 'react-native';
import {Canvas, RoundedRect} from '@shopify/react-native-skia';
import {useChartTheme} from '@components/Charts/BaseChart';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import type {WeekStart} from '@libs/Statistics';

type DowHourHeatmapProps = {
  /**
   * Bucket value (units) keyed by `${dow}${COMPOSITE_KEY_SEP}${hour}` —
   * exactly the shape produced by
   * `aggregate(events, composeBuckets(byDow, byHour), sumUnits)`. The
   * component splits the key with the unit separator itself.
   */
  buckets: ReadonlyMap<string, number>;
  /**
   * 0..6, Sun..Sat. The `localDow` field on `DrinkEvent` is already rotated
   * so that 0 = the user's `WeekStart`; passing the same value here lets the
   * heatmap label rows with the correct weekday names.
   */
  weekStart: WeekStart;
  accessibilityLabel: string;
  /** Pixel gap between cells. Default 1 (denser than CalendarHeatmap's 2). */
  gap?: number;
  /** Overlay copy when every bucket is zero. When omitted, no overlay renders. */
  emptyLabel?: string;
};

const HOURS = 24;
const DAYS = 7;
const LABEL_GUTTER = 32;
const HOUR_LABEL_HEIGHT = 16;
const COMPOSITE_SEP = '\x1f';
const SHORT_DAY_NAMES = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

function formatHourTick(hour: number): string {
  if (hour === 0) {
    return '12a';
  }
  if (hour === 12) {
    return '12p';
  }
  const label = hour > 12 ? hour - 12 : hour;
  const suffix = hour < 12 ? 'a' : 'p';
  return `${label}${suffix}`;
}

function intensityFor(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (max <= 0 || value <= 0) {
    return 0;
  }
  const r = value / max;
  if (r < 0.25) {
    return 1;
  }
  if (r < 0.5) {
    return 2;
  }
  if (r < 0.75) {
    return 3;
  }
  return 4;
}

/**
 * 7×24 heatmap of drinking activity by day-of-week × hour-of-day. Direct
 * Skia draw, modelled on `CalendarHeatmap` — one RoundedRect per cell, color
 * from the shared 5-stop yellow→orange ramp. Invisible RN View overlays
 * carry per-cell `accessibilityLabel` since Skia draws to canvas with no
 * native a11y handles.
 */
function DowHourHeatmap({
  buckets,
  weekStart,
  accessibilityLabel,
  gap = 1,
  emptyLabel,
}: DowHourHeatmapProps) {
  const [width, setWidth] = useState(0);
  const theme = useChartTheme();
  const styles = useThemeStyles();

  const dayLabels = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < DAYS; i++) {
      out.push(SHORT_DAY_NAMES[(weekStart + i) % DAYS]);
    }
    return out;
  }, [weekStart]);

  const gridWidth = Math.max(0, width - LABEL_GUTTER);
  const cellSize = gridWidth > 0 ? Math.floor(gridWidth / HOURS) : 0;
  const innerSize = Math.max(0, cellSize - gap);
  const gridHeight = cellSize * DAYS;
  const totalHeight = gridHeight + HOUR_LABEL_HEIGHT;

  const cells = useMemo(() => {
    const out: Array<{
      dow: number;
      hour: number;
      value: number;
      intensity: 0 | 1 | 2 | 3 | 4;
    }> = [];
    let max = 0;
    buckets.forEach(v => {
      if (v > max) {
        max = v;
      }
    });
    for (let dow = 0; dow < DAYS; dow++) {
      for (let hour = 0; hour < HOURS; hour++) {
        const value = buckets.get(`${dow}${COMPOSITE_SEP}${hour}`) ?? 0;
        out.push({dow, hour, value, intensity: intensityFor(value, max)});
      }
    }
    return out;
  }, [buckets]);

  const hasData = cells.some(c => c.value > 0);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{width: '100%', height: totalHeight || 8}}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {cellSize > 0 ? (
        <>
          {/* Left-edge day labels, one per row. */}
          {dayLabels.map((label, dow) => (
            <View
              key={label}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: dow * cellSize,
                width: LABEL_GUTTER,
                height: cellSize,
                justifyContent: 'center',
              }}>
              <Text style={[styles.textMicroSupporting]}>{label}</Text>
            </View>
          ))}
          <Canvas
            style={{
              width: gridWidth,
              height: gridHeight,
              position: 'absolute',
              left: LABEL_GUTTER,
              top: 0,
            }}>
            {cells.map(cell => (
              <RoundedRect
                key={`${cell.dow}-${cell.hour}`}
                x={cell.hour * cellSize + gap / 2}
                y={cell.dow * cellSize + gap / 2}
                width={innerSize}
                height={innerSize}
                r={2}
                color={theme.intensityRamp[cell.intensity]}
              />
            ))}
          </Canvas>
          {/* Per-cell a11y overlays — mirrors CalendarHeatmap's pattern. */}
          {cells.map(cell => (
            <View
              key={`a11y-${cell.dow}-${cell.hour}`}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${dayLabels[cell.dow]} ${cell.hour}:00, ${Math.round(cell.value * 10) / 10} units`}
              style={{
                position: 'absolute',
                left: LABEL_GUTTER + cell.hour * cellSize,
                top: cell.dow * cellSize,
                width: cellSize,
                height: cellSize,
              }}
            />
          ))}
          {/* Hour ticks below the grid at 0 / 6 / 12 / 18. */}
          {[0, 6, 12, 18].map(hour => (
            <View
              key={`tick-${hour}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: LABEL_GUTTER + hour * cellSize - 12,
                top: gridHeight + 2,
                width: 24,
                alignItems: 'center',
              }}>
              <Text style={[styles.textMicroSupporting]}>
                {formatHourTick(hour)}
              </Text>
            </View>
          ))}
          {!hasData && emptyLabel ? (
            <View
              pointerEvents="none"
              style={[
                styles.alignItemsCenter,
                styles.justifyContentCenter,
                {
                  position: 'absolute',
                  left: LABEL_GUTTER,
                  top: 0,
                  width: gridWidth,
                  height: gridHeight,
                },
              ]}>
              <Text style={[styles.textSupporting, styles.textAlignCenter]}>
                {emptyLabel}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export default DowHourHeatmap;
export type {DowHourHeatmapProps};
