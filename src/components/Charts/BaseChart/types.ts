import type {ReactNode} from 'react';
import type {ChartBounds, PointsArray} from 'victory-native';
import type {ChartDatum, ChartRange} from '@libs/Statistics';

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
  /** Stroke color for muted comparison ("vs previous period") lines. */
  comparisonStroke: string;
  /** Five-stop intensity ramp for the heatmap, indices 0..4. */
  intensityRamp: [string, string, string, string, string];
  /**
   * Seven-stop yellow→orange ramp keyed to the canonical DrinkKey order
   * (`small_beer`, `beer`, `wine`, `cocktail`, `strong_shot`, `weak_shot`,
   * `other`). No red, no black — see STATISTICS_V2.md §3.
   */
  drinkTypeRamp: [string, string, string, string, string, string, string];
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
  children?: (ctx: ChartRenderCtx<TYKey>) => ReactNode;
};

export type {BaseChartDatum, BaseChartProps, ChartRenderCtx, ChartTheme};
