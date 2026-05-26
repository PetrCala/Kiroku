import {useState} from 'react';
import {View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import KpiRowSkeleton from './KpiRowSkeleton';

type ChartSkeletonVariant =
  | 'card'
  | 'bars'
  | 'line'
  | 'calendar'
  | 'kpiRow'
  | 'kpi'
  | 'polar'
  | 'donut'
  | 'grid'
  | 'heatmapWeekHour';

type ChartSkeletonProps = {
  variant: ChartSkeletonVariant;
  /** Fixed height in dp. Sensible variant-specific defaults if omitted. */
  height?: number;
  /** Width in dp. Defaults to 100% of parent. */
  width?: number | `${number}%`;
  /** Accessibility label announced to screen readers while loading. */
  accessibilityLabel?: string;
};

const DEFAULT_HEIGHT: Record<ChartSkeletonVariant, number> = {
  card: 200,
  bars: 200,
  line: 120,
  calendar: 180,
  kpiRow: 96,
  kpi: 96,
  polar: 220,
  donut: 220,
  grid: 200,
  heatmapWeekHour: 220,
};

/**
 * Layout-faithful skeleton placeholder for a chart. Renders a static grey
 * scaffold sized to match the real chart's bounding box plus a hint of its
 * internal structure (grid lines, ring, bars). No animation — the goal is
 * a non-distracting hint that "something is loading here," not a moving
 * shimmer that competes for attention with the rest of the screen.
 *
 * Variants:
 * - `card`: plain rounded rectangle, matches generic ChartCard body.
 * - `bars`: row of faint vertical rectangles.
 * - `line`: single faint horizontal stripe — matches sparkline/trend-line.
 * - `calendar`: 6×7 grid of small rounded cells — matches CalendarHeatmap.
 * - `kpiRow`: 3 (or 2 narrow) tile placeholders side by side.
 * - `kpi`: single KPI tile placeholder.
 * - `polar`: faint circle outline — matches HourPolar bounding circle.
 * - `donut`: ring (outer + inner concentric circles).
 * - `grid`: horizontal grid lines on a baseline — generic chart canvas.
 * - `heatmapWeekHour`: 7×24 cell grid — matches DowHourHeatmap.
 */
function ChartSkeleton({
  variant,
  height,
  width = '100%',
  accessibilityLabel,
}: ChartSkeletonProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const resolvedHeight = height ?? DEFAULT_HEIGHT[variant];
  const fill = theme.borderLighter;
  const cardFill = theme.highlightBG;
  const a11yLabel = accessibilityLabel ?? 'Loading';

  if (variant === 'card') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={{
          height: resolvedHeight,
          width,
          backgroundColor: cardFill,
          borderRadius: 12,
        }}
      />
    );
  }

  if (variant === 'bars') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={[
          styles.flexRow,
          styles.alignItemsEnd,
          styles.justifyContentBetween,
          styles.ph2,
          {height: resolvedHeight, width},
        ]}>
        {[0.5, 0.8, 0.65, 0.95, 0.55, 0.75, 0.6].map((h, idx) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={`bar-${idx}`}
            style={[
              styles.flex1,
              styles.mh1,
              {
                height: `${h * 100}%`,
                backgroundColor: fill,
                borderRadius: 4,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (variant === 'line') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={[styles.justifyContentCenter, {height: resolvedHeight, width}]}>
        <View
          style={{
            height: 2,
            width: '100%',
            backgroundColor: fill,
            borderRadius: 1,
          }}
        />
      </View>
    );
  }

  if (variant === 'grid') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={[
          styles.justifyContentBetween,
          styles.pv4,
          {height: resolvedHeight, width},
        ]}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={`gridline-${i}`}
            style={{height: 1, width: '100%', backgroundColor: fill}}
          />
        ))}
      </View>
    );
  }

  if (variant === 'calendar') {
    const ROWS = 6;
    const COLS = 7;
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={[styles.justifyContentBetween, {height: resolvedHeight, width}]}>
        {Array.from({length: ROWS}, (_row, row) => (
          <View
            key={`cal-row-${row}`}
            style={[styles.flexRow, styles.justifyContentBetween]}>
            {Array.from({length: COLS}, (_col, col) => (
              <View
                key={`cal-${row}-${col}`}
                style={[
                  styles.flex1,
                  {
                    aspectRatio: 1,
                    marginHorizontal: 1,
                    backgroundColor: fill,
                    borderRadius: 3,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'kpi') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={[
          styles.p3,
          styles.justifyContentBetween,
          {
            height: resolvedHeight,
            width,
            backgroundColor: cardFill,
            borderRadius: 12,
          },
        ]}>
        <View
          style={{
            height: 10,
            width: '50%',
            backgroundColor: fill,
            borderRadius: 2,
          }}
        />
        <View
          style={{
            height: 24,
            width: '40%',
            backgroundColor: fill,
            borderRadius: 4,
          }}
        />
        <View
          style={{
            height: 10,
            width: '60%',
            backgroundColor: fill,
            borderRadius: 2,
          }}
        />
      </View>
    );
  }

  if (variant === 'kpiRow') {
    return (
      <KpiRowSkeleton height={resolvedHeight} accessibilityLabel={a11yLabel} />
    );
  }

  if (variant === 'polar') {
    const diameter = resolvedHeight - 16;
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={[
          styles.alignItemsCenter,
          styles.justifyContentCenter,
          {height: resolvedHeight, width},
        ]}>
        <View
          style={{
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderWidth: 1,
            borderColor: fill,
          }}
        />
      </View>
    );
  }

  if (variant === 'donut') {
    const outer = resolvedHeight - 16;
    const inner = outer * 0.55;
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={[
          styles.alignItemsCenter,
          styles.justifyContentCenter,
          {height: resolvedHeight, width},
        ]}>
        <View
          style={[
            styles.alignItemsCenter,
            styles.justifyContentCenter,
            {
              width: outer,
              height: outer,
              borderRadius: outer / 2,
              backgroundColor: fill,
            },
          ]}>
          <View
            style={{
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: cardFill,
            }}
          />
        </View>
      </View>
    );
  }

  // heatmapWeekHour: 7 rows (days) × 24 cols (hours) of faint cells.
  return (
    <HeatmapWeekHourSkeleton
      height={resolvedHeight}
      fill={fill}
      accessibilityLabel={a11yLabel}
    />
  );
}

type HeatmapWeekHourSkeletonProps = {
  height: number;
  fill: string;
  accessibilityLabel: string;
};

const HEATMAP_ROWS = 7;
const HEATMAP_COLS = 24;

function HeatmapWeekHourSkeleton({
  height,
  fill,
  accessibilityLabel,
}: HeatmapWeekHourSkeletonProps) {
  const [width, setWidth] = useState(0);
  const styles = useThemeStyles();
  const cellSize = width > 0 ? Math.floor(width / HEATMAP_COLS) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{height, width: '100%'}}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {cellSize > 0 ? (
        <View style={styles.flexColumn}>
          {Array.from({length: HEATMAP_ROWS}, (_row, r) => (
            <View key={`row-${r}`} style={styles.flexRow}>
              {Array.from({length: HEATMAP_COLS}, (_col, c) => (
                <View
                  key={`cell-${r}-${c}`}
                  style={{
                    width: cellSize - 1,
                    height: cellSize - 1,
                    margin: 0.5,
                    backgroundColor: fill,
                    borderRadius: 2,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default ChartSkeleton;
export type {ChartSkeletonProps, ChartSkeletonVariant};
