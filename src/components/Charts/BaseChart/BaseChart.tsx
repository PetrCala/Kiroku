import {View} from 'react-native';
import {CartesianChart} from 'victory-native';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import A11yOverlay from './A11yOverlay';
import type {BaseChartProps, ChartRenderCtx} from './types';
import useChartTheme from './useChartTheme';

const DEFAULT_HEIGHT = 200;
const DEFAULT_Y_KEYS = ['y'] as const;

/**
 * Theme-aware wrapper around `victory-native`'s `CartesianChart`. The only
 * file in the chart layer that imports `victory-native` — concrete charts
 * (WeeklyBars, TrendLine, StackedArea) consume this primitive through its
 * render-prop and never touch Victory directly.
 *
 * `yKeys` defaults to `['y']` (the canonical `ChartDatum` shape). Multi-
 * series charts pass a wider tuple, and `data` rows must include numeric
 * fields for every key (zero-fill the gaps upstream).
 *
 * When `data` is empty and `emptyLabel` is provided, BaseChart short-circuits
 * to a reassuring text state. Otherwise it renders the chart canvas wrapped
 * in an `A11yOverlay` so VoiceOver / TalkBack can announce it (Skia draws to
 * canvas with no native a11y nodes — the overlay is the only handhold).
 */
function BaseChart<TYKey extends string = 'y'>({
  data,
  yKeys,
  accessibilityLabel,
  emptyLabel,
  height = DEFAULT_HEIGHT,
  hideAxes = false,
  loading = false,
  children,
}: BaseChartProps<TYKey>) {
  const styles = useThemeStyles();
  const theme = useChartTheme();
  const isEmpty = data.length === 0;

  if (loading) {
    return (
      <ChartSkeleton
        variant="grid"
        height={height}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

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

  const resolvedYKeys =
    yKeys ?? (DEFAULT_Y_KEYS as unknown as readonly TYKey[]);

  // Victory's CartesianChart binds `data` shape to `xKey` and `yKeys` at the
  // type level, but BaseChart accepts a generic record-shaped row so concrete
  // charts can pass arbitrary series. The runtime contract is identical
  // (every row has `x` plus a numeric field for each key); the cast just
  // bridges the structural typing.
  type CastedRow = Record<string, string | number> & {x: string | number};
  const castedData = data as CastedRow[];
  const castedYKeys = resolvedYKeys as ReadonlyArray<
    Extract<keyof CastedRow, string>
  >;

  return (
    <A11yOverlay accessibilityLabel={accessibilityLabel}>
      <View style={{height}}>
        <CartesianChart
          data={castedData}
          xKey="x"
          yKeys={castedYKeys as never}
          axisOptions={axisOptions}
          domainPadding={domainPadding}>
          {ctx =>
            children?.({...ctx, theme} as unknown as ChartRenderCtx<TYKey>)
          }
        </CartesianChart>
      </View>
    </A11yOverlay>
  );
}

export default BaseChart;
