import {View} from 'react-native';
import {BaseChart, Line} from '@components/Charts/BaseChart';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {ChartDatum} from '@libs/Statistics';

type MiniLineChartProps = {
  title: string;
  caption: string;
  data: ChartDatum[];
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
  accessibilityLabel,
  strokeColor,
}: MiniLineChartProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

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
        data={data}
        range="rolling8w"
        accessibilityLabel={accessibilityLabel}
        height={48}
        hideAxes>
        {({points}) => (
          <Line points={points.y} color={strokeColor} strokeWidth={1.5} />
        )}
      </BaseChart>
    </View>
  );
}

MiniLineChart.displayName = 'MiniLineChart';

export default MiniLineChart;
export type {MiniLineChartProps};
