import {useState} from 'react';
import {View} from 'react-native';
import Skeleton from '@components/Skeleton';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import KpiRowSkeleton from './KpiRowSkeleton';

type ChartSkeletonVariant =
  | 'card'
  | 'bars'
  | 'barList'
  | 'line'
  | 'distribution'
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
  /** Tile count for the `kpiRow` variant. Ignored by other variants. */
  count?: number;
};

const DEFAULT_HEIGHT: Record<ChartSkeletonVariant, number> = {
  card: 200,
  bars: 200,
  barList: 120,
  line: 120,
  distribution: 48,
  calendar: 180,
  kpiRow: 96,
  kpi: 96,
  polar: 220,
  donut: 220,
  grid: 200,
  heatmapWeekHour: 220,
};

/**
 * Layout-faithful skeleton placeholder for a chart. Sized to match the real
 * chart's bounding box plus a hint of its internal structure (bars, ring,
 * cells). Built on the shared `Skeleton` primitive: the prominent block
 * placeholders (card body, bars, KPI tiles, etc.) shimmer with the unified
 * `skeletonBase`/`skeletonHighlight` tokens, while the decorative structure
 * that doesn't read well as a moving block — thin grid lines, ring outlines,
 * and the dense calendar/heatmap cell grids — stays static in `skeletonBase`.
 *
 * Variants:
 * - `card`: plain rounded rectangle, matches generic ChartCard body.
 * - `bars`: row of vertical bars.
 * - `barList`: stack of horizontal label + track rows — matches BarList.
 * - `line`: single thin horizontal stripe — matches sparkline/trend-line.
 * - `distribution`: thin segmented bar + legend — matches DistributionBar.
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
  count,
}: ChartSkeletonProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const resolvedHeight = height ?? DEFAULT_HEIGHT[variant];
  // Static fill for decorative structure that doesn't shimmer (rings, grid
  // lines, dense cell grids) — the resting tone of the shimmering blocks so
  // every skeleton reads as one colour family.
  const fill = theme.skeletonBase;
  const cardFill = theme.highlightBG;
  const a11yLabel = accessibilityLabel ?? 'Loading';

  if (variant === 'card') {
    return (
      <Skeleton
        width={width}
        height={resolvedHeight}
        radius={12}
        accessibilityLabel={a11yLabel}
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
        {[0.5, 0.8, 0.65, 0.95, 0.55, 0.75, 0.6].map((h, idx) => {
          const barHeight = Math.round(h * resolvedHeight);
          return (
            <View
              // eslint-disable-next-line react/no-array-index-key
              key={`bar-${idx}`}
              style={[styles.flex1, styles.mh1, {height: barHeight}]}>
              <Skeleton width="100%" height={barHeight} radius={4} />
            </View>
          );
        })}
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
        <Skeleton width="100%" height={2} radius={1} />
      </View>
    );
  }

  if (variant === 'barList') {
    // Mirrors BarList: a column of `label … ▮▮▮ value` rows. Fractions hint at
    // the varying bar lengths without computing real data.
    const fractions = [0.9, 0.7, 0.85, 0.5, 0.65];
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={{height: resolvedHeight, width}}>
        {fractions.map((frac, idx) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={`barlist-${idx}`}
            style={[styles.flex1, styles.flexRow, styles.alignItemsCenter]}>
            <Skeleton width={28} height={8} radius={2} />
            <View style={[styles.flex1, styles.mh1]}>
              <Skeleton width={`${frac * 100}%`} height={8} radius={4} />
            </View>
            <Skeleton width={22} height={8} radius={2} />
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'distribution') {
    // Mirrors DistributionBar: a thin full-width segmented bar above a wrapped
    // color-keyed legend row.
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        style={{height: resolvedHeight, width}}>
        <Skeleton width="100%" height={12} radius={6} />
        <View style={[styles.flexRow, styles.flexWrap, styles.mt2]}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={`legend-${i}`}
              style={[styles.flexRow, styles.alignItemsCenter, styles.mr3]}>
              <Skeleton circle height={8} style={styles.mr1} />
              <Skeleton width={36} height={8} radius={2} />
            </View>
          ))}
        </View>
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
        <Skeleton width="50%" height={10} radius={2} />
        <Skeleton width="40%" height={24} radius={4} />
        <Skeleton width="60%" height={10} radius={2} />
      </View>
    );
  }

  if (variant === 'kpiRow') {
    return (
      <KpiRowSkeleton
        height={resolvedHeight}
        accessibilityLabel={a11yLabel}
        count={count}
      />
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
