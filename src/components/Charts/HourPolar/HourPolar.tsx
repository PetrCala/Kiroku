import {useMemo, useState} from 'react';
import {View} from 'react-native';
import {Canvas, Circle, Path, Skia} from '@shopify/react-native-skia';
import {useChartTheme} from '@components/Charts/BaseChart';
import {PressableWithoutFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';

type HourPolarProps = {
  /** Bucket value (units) keyed by `localHour` 0..23. Missing hours = 0. */
  buckets: ReadonlyMap<number, number>;
  accessibilityLabel: string;
  /** Optional label for hour 12 / 0 / 6 / 18; defaults to '12 AM' etc. */
  labelForHour?: (hour: number) => string;
  /** Optional spoke tap. v1 wires the prop; no-op until v2-K drill-down lands. */
  onSpokePress?: (hour: number) => void;
  /** Square canvas size in dp; defaults to the parent width. */
  size?: number;
  /** Overlay copy when every bucket is zero. When omitted, no overlay renders. */
  emptyLabel?: string;
};

const TAU = Math.PI * 2;
const WEDGE_COUNT = 24;
const WEDGE_RAD = TAU / WEDGE_COUNT;
const ARC_SEGMENTS = 6;
const CENTER_PADDING = 18;
const RIM_INSET = 4;
const MIN_TAP_TARGET = 44;

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

function defaultLabelForHour(hour: number): string {
  if (hour === 0) {
    return '12 AM';
  }
  if (hour === 12) {
    return '12 PM';
  }
  if (hour < 12) {
    return `${hour} AM`;
  }
  return `${hour - 12} PM`;
}

/**
 * Hour-of-day polar chart. 24 filled wedges around a 360° dial, each spanning
 * 15° clockwise from midnight at top. Wedge outer radius encodes the bucket
 * value; fill color picks from the shared 5-stop yellow→orange ramp (never
 * red — design doc §3) so the encoding is redundant for color-blind users.
 *
 * Drawn directly with Skia, mirroring `CalendarHeatmap`. Hour labels and tap
 * targets live as RN overlays — no Skia font assets to wire up.
 */
function HourPolar({
  buckets,
  accessibilityLabel,
  labelForHour = defaultLabelForHour,
  onSpokePress,
  size,
  emptyLabel,
}: HourPolarProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const theme = useChartTheme();
  const styles = useThemeStyles();

  const side = size ?? measuredWidth;
  const cx = side / 2;
  const cy = side / 2;
  const radius = Math.max(0, side / 2 - CENTER_PADDING);

  const maxValue = useMemo(() => {
    let max = 0;
    buckets.forEach(v => {
      if (v > max) {
        max = v;
      }
    });
    return max;
  }, [buckets]);

  const wedges = useMemo(() => {
    if (radius <= 0) {
      return [];
    }
    const out: Array<{
      hour: number;
      path: ReturnType<typeof Skia.Path.Make>;
      color: string;
    }> = [];
    for (let hour = 0; hour < WEDGE_COUNT; hour++) {
      const value = buckets.get(hour) ?? 0;
      const intensity = intensityFor(value, maxValue);
      const ratio = maxValue > 0 ? value / maxValue : 0;
      // Always draw a hair-thin rim wedge when intensity > 0 but ratio < some
      // floor, so a non-zero bucket is visible even with one tiny event.
      const drawRatio = intensity === 0 ? 0 : Math.max(ratio, 0.08);
      const r = drawRatio * radius;
      if (r <= 0) {
        continue;
      }
      // Wedge centered on hour. Rotate so 0° = 12 o'clock (top), clockwise.
      const center = -Math.PI / 2 + hour * WEDGE_RAD;
      const a0 = center - WEDGE_RAD / 2;
      const a1 = center + WEDGE_RAD / 2;
      const path = Skia.Path.Make();
      path.moveTo(cx, cy);
      for (let s = 0; s <= ARC_SEGMENTS; s++) {
        const t = s / ARC_SEGMENTS;
        const a = a0 + (a1 - a0) * t;
        path.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      path.close();
      out.push({
        hour,
        path,
        color: theme.intensityRamp[intensity],
      });
    }
    return out;
  }, [buckets, cx, cy, maxValue, radius, theme.intensityRamp]);

  const axisRadius = Math.max(0, radius - RIM_INSET);

  const hasData = maxValue > 0;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{
        width: '100%',
        aspectRatio: 1,
        maxHeight: size,
      }}
      onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}>
      {side > 0 ? (
        <>
          <Canvas style={{width: side, height: side, position: 'absolute'}}>
            {axisRadius > 0 ? (
              <Circle
                cx={cx}
                cy={cy}
                r={axisRadius}
                color={theme.gridLine}
                // eslint-disable-next-line react/style-prop-object -- Skia uses string literal for `style`
                style="stroke"
                strokeWidth={1}
              />
            ) : null}
            {wedges.map(w => (
              <Path key={w.hour} path={w.path} color={w.color} />
            ))}
          </Canvas>
          {/* Cardinal hour labels — 12 AM at top, 6 AM right, 12 PM bottom, 6 PM left. */}
          {[0, 6, 12, 18].map(hour => {
            const angle = -Math.PI / 2 + hour * WEDGE_RAD;
            const labelR = radius + 4;
            const lx = cx + labelR * Math.cos(angle);
            const ly = cy + labelR * Math.sin(angle);
            return (
              <View
                key={`label-${hour}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: lx - 24,
                  top: ly - 8,
                  width: 48,
                  alignItems: 'center',
                }}>
                <Text style={[styles.textMicroSupporting]}>
                  {labelForHour(hour)}
                </Text>
              </View>
            );
          })}
          {/* Invisible per-spoke tap + a11y targets. Bounding-box rectangles
              around each wedge's outer arc — exact wedge shape isn't worth
              the geometry for tap. */}
          {Array.from({length: WEDGE_COUNT}, (_, hour) => {
            const value = buckets.get(hour) ?? 0;
            const angle = -Math.PI / 2 + hour * WEDGE_RAD;
            // Anchor the touchable mid-radius so the thumb hits comfortably.
            const anchorR = radius * 0.5;
            const ax = cx + anchorR * Math.cos(angle);
            const ay = cy + anchorR * Math.sin(angle);
            const targetSize = Math.max(MIN_TAP_TARGET, radius / 4);
            return (
              <PressableWithoutFeedback
                key={`spoke-${hour}`}
                role="button"
                accessibilityLabel={`${labelForHour(hour)}, ${Math.round(value * 10) / 10} units`}
                onPress={() => onSpokePress?.(hour)}
                style={{
                  position: 'absolute',
                  left: ax - targetSize / 2,
                  top: ay - targetSize / 2,
                  width: targetSize,
                  height: targetSize,
                }}
              />
            );
          })}
          {!hasData && emptyLabel ? (
            <View
              pointerEvents="none"
              style={[
                styles.alignItemsCenter,
                styles.justifyContentCenter,
                {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: side,
                  height: side,
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

export default HourPolar;
export type {HourPolarProps};
