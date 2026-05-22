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
  /** Five-stop intensity ramp for the heatmap, indices 0..4. */
  intensityRamp: [string, string, string, string, string];
};

/**
 * Render context handed to a chart's render-prop children. Wraps Victory's
 * own context with our theme colors so concrete charts don't have to
 * re-derive theming.
 */
type ChartRenderCtx<TYKey extends string = 'y'> = {
  points: Record<TYKey, PointsArray>;
  chartBounds: ChartBounds;
  theme: ChartTheme;
};

type BaseChartProps = {
  data: ChartDatum[];
  range: ChartRange;
  /** Required — Skia draws to a canvas with no native a11y nodes. */
  accessibilityLabel: string;
  /** Shown in place of the chart when `data` is empty. */
  emptyLabel?: string;
  /** Fixed height in dp. Default 200. */
  height?: number;
  children?: (ctx: ChartRenderCtx) => ReactNode;
};

export type {BaseChartProps, ChartRenderCtx, ChartTheme};
