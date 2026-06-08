import type {ReactNode} from 'react';
import type {SkFont} from '@shopify/react-native-skia';
import type {ChartBounds, PointsArray} from 'victory-native';
import type {ChartDatum, ChartRange} from '@libs/Statistics';

/**
 * Optional axis customization forwarded to victory-native's `axisOptions`.
 * When omitted, BaseChart's axis behavior is unchanged (no numeric labels —
 * victory needs a `font` to render them).
 */
type ChartAxisOptions = {
  /** Skia font for tick labels. Without it victory draws ticks but no numbers. */
  font?: SkFont | null;
  /** Approximate tick counts; victory picks nice values. */
  tickCount?: number | {x: number; y: number};
  /** Explicit tick positions (per-axis or a single x-array). */
  tickValues?: number[] | {x: number[]; y: number[]};
  /** Formats an x tick value into its label. */
  formatXLabel?: (value: number) => string;
  /** Formats a y tick value into its label. */
  formatYLabel?: (value: number) => string;
};

/**
 * Theme colors a chart implementation can pull. Sourced from
 * `useChartTheme` which composes ThemeContext + the user's
 * `units_to_colors` preference.
 */
type ChartTheme = {
  /** Axis tick text color. */
  axisLabel: string;
  /** Axis baseline + tick mark color. */
  axisLine: string;
  /** Grid lines (subtle horizontal/vertical rulers). */
  gridLine: string;
  /** Primary fill / bar color. */
  primaryFill: string;
  /** Primary stroke / line color. */
  primaryStroke: string;
  /** Translucent fill for the "band of normal" overlay. */
  bandFill: string;
  /** Faint accent fill for raw "weekly units" bars. */
  barFill: string;
  /** Deeper-amber stroke for the prominent weekly trend line. */
  trendStroke: string;
  /** Stroke color for muted comparison ("vs previous period") lines. */
  comparisonStroke: string;
  /** Five-stop intensity ramp for the heatmap, indices 0..4. */
  intensityRamp: [string, string, string, string, string];
};

/**
 * Render context handed to a chart's render-prop children. Wraps Victory's
 * own context with our theme colors so concrete charts don't have to
 * re-derive theming.
 */
type ChartRenderCtx<TYKey extends string = string> = {
  points: Record<TYKey, PointsArray>;
  chartBounds: ChartBounds;
  theme: ChartTheme;
};

type BaseChartDatum = ChartDatum | Record<string, string | number>;

type BaseChartProps<TYKey extends string = 'y'> = {
  data: BaseChartDatum[];
  range: ChartRange;
  /**
   * Y-axis keys to project. Defaults to `['y']`, matching the canonical
   * `ChartDatum` shape used by `WeeklyBars` and `Sparkline`. Charts with
   * multiple series (TrendLine + EWMA, StackedArea) pass extra keys.
   */
  yKeys?: readonly TYKey[];
  /** Required — Skia draws to a canvas with no native a11y nodes. */
  accessibilityLabel: string;
  /** Shown in place of the chart when `data` is empty. */
  emptyLabel?: string;
  /** Fixed height in dp. Default 200. */
  height?: number;
  /** Suppresses axis labels, ticks, and padding. Use for inline sparklines. */
  hideAxes?: boolean;
  /** Optional axis customization. When omitted, axis behavior is unchanged. */
  axis?: ChartAxisOptions;
  /**
   * When true, short-circuits to a layout-faithful skeleton matching
   * `height` instead of rendering the Skia canvas. Used during the
   * Statistics first-paint window so the tab transition stays on a single
   * frame; see `useDrinkEvents` for the loading source-of-truth.
   */
  loading?: boolean;
  children?: (ctx: ChartRenderCtx<TYKey>) => ReactNode;
};

export type {
  BaseChartDatum,
  BaseChartProps,
  ChartAxisOptions,
  ChartRenderCtx,
  ChartTheme,
};
