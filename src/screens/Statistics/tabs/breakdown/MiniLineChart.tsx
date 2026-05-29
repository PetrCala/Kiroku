import {View} from 'react-native';
import {DashPathEffect} from '@shopify/react-native-skia';
import {BaseChart, Line} from '@components/Charts/BaseChart';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {ChartDatum} from '@libs/Statistics';

const COMPARISON_DASH: number[] = [4, 4];

type MiniLineChartProps = {
  title: string;
  caption: string;
  data: ChartDatum[];
  /**
   * Optional comparison y-series, index-aligned to `data`. When present it's
   * drawn as a dashed muted line behind the current series (mirrors the
   * Trends tab's "vs previous period" overlay).
   */
  comparison?: number[];
  accessibilityLabel: string;
  strokeColor: string;
};

/**
 * Small-multiple tile: header (drink-type label + period total) over a
 * compact axis-less line chart in the drink-type's brand color. Each tile
 * is independently y-scaled — the spec calls for shared y "only when
 * meaningful," and per-tile scaling reads better when one type dominates
 * the window.
 */
function MiniLineChart({
  title,
  caption,
  data,
  comparison,
  accessibilityLabel,
  strokeColor,
}: MiniLineChartProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  const showComparison = !!comparison && comparison.length === data.length;
  const rows = showComparison
    ? data.map((d, i) => ({x: d.x, y: d.y, cmp: comparison?.[i] ?? 0}))
    : data;
  const yKeys: ReadonlyArray<'y' | 'cmp'> | undefined = showComparison
    ? ['y', 'cmp']
    : undefined;

  return (
    <View
      style={[
        styles.p3,
        {
          backgroundColor: theme.highlightBG,
          borderRadius: 10,
        },
      ]}>
      <Text style={[styles.textLabelSupporting, styles.textStrong]}>
        {title}
      </Text>
      <Text style={[styles.textMicroSupporting, styles.mb1]}>{caption}</Text>
      <BaseChart
        data={rows}
        yKeys={yKeys}
        range="rolling8w"
        accessibilityLabel={accessibilityLabel}
        height={48}
        hideAxes>
        {({points, theme: chartTheme}) => (
          <>
            {showComparison ? (
              <Line
                points={points.cmp}
                color={chartTheme.comparisonStroke}
                strokeWidth={1.25}>
                <DashPathEffect intervals={COMPARISON_DASH} />
              </Line>
            ) : null}
            <Line points={points.y} color={strokeColor} strokeWidth={1.5} />
          </>
        )}
      </BaseChart>
    </View>
  );
}

MiniLineChart.displayName = 'MiniLineChart';

export default MiniLineChart;
export type {MiniLineChartProps};
