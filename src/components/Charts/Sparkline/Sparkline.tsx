import {BaseChart, Line} from '@components/Charts/BaseChart';
import type {ChartDatum} from '@libs/Statistics';

type SparklineProps = {
  data: ChartDatum[];
  accessibilityLabel: string;
  /** Default 32 dp — fits inside KpiCard. */
  height?: number;
};

/**
 * A tiny axis-less line chart for inline use (KpiCard hero rows, list
 * cells). Wraps BaseChart with `hideAxes`. Empty data renders nothing —
 * sparklines shouldn't show an explanatory empty state inside another card.
 */
function Sparkline({data, accessibilityLabel, height = 32}: SparklineProps) {
  if (data.length === 0) {
    return null;
  }
  return (
    <BaseChart
      data={data}
      range="rolling30"
      accessibilityLabel={accessibilityLabel}
      height={height}
      hideAxes>
      {({points, theme}) => (
        <Line points={points.y} color={theme.primaryStroke} strokeWidth={1.5} />
      )}
    </BaseChart>
  );
}

export default Sparkline;
export type {SparklineProps};
