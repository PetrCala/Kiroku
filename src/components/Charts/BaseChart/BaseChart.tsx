import {View} from 'react-native';
import {CartesianChart} from 'victory-native';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import A11yOverlay from './A11yOverlay';
import type {BaseChartProps} from './types';
import useChartTheme from './useChartTheme';

const DEFAULT_HEIGHT = 200;

/**
 * Theme-aware wrapper around `victory-native`'s `CartesianChart`. The only
 * file in the chart layer that imports `victory-native` — concrete charts
 * (WeeklyBars, future TrendLine) consume this primitive through its
 * render-prop and never touch Victory directly.
 *
 * When `data` is empty and `emptyLabel` is provided, BaseChart short-circuits
 * to a reassuring text state. Otherwise it renders the chart canvas wrapped
 * in an `A11yOverlay` so VoiceOver / TalkBack can announce it (Skia draws to
 * canvas with no native a11y nodes — the overlay is the only handhold).
 */
function BaseChart({
  data,
  accessibilityLabel,
  emptyLabel,
  height = DEFAULT_HEIGHT,
  hideAxes = false,
  children,
}: BaseChartProps) {
  const styles = useThemeStyles();
  const theme = useChartTheme();
  const isEmpty = data.length === 0;

  if (isEmpty && emptyLabel) {
    return (
      <View
        accessible
        accessibilityLabel={emptyLabel}
        style={[
          styles.alignItemsCenter,
          styles.justifyContentCenter,
          {height},
        ]}>
        <Text style={[styles.textSupporting, styles.textAlignCenter]}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const axisOptions = hideAxes
    ? undefined
    : {labelColor: theme.axisLabel, lineColor: theme.axisLine};
  const domainPadding = hideAxes
    ? 0
    : {left: 24, right: 24, top: 16, bottom: 0};

  return (
    <A11yOverlay accessibilityLabel={accessibilityLabel}>
      <View style={{height}}>
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={['y']}
          axisOptions={axisOptions}
          domainPadding={domainPadding}>
          {ctx => children?.({...ctx, theme})}
        </CartesianChart>
      </View>
    </A11yOverlay>
  );
}

export default BaseChart;
