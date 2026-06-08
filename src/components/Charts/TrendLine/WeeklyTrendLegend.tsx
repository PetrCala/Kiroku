import {View} from 'react-native';
import {useChartTheme} from '@components/Charts/BaseChart';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';

type WeeklyTrendLegendProps = {
  /** Show the "Trend" item — hidden when there's no EWMA line (sparse data). */
  showTrend: boolean;
  /** Show the dashed "Previous period" item — Compare mode only. */
  showComparison: boolean;
};

/**
 * Color key for the weekly-units chart: a faint bar swatch ("this period"), a
 * solid deeper line ("trend"), and a dashed line ("previous period"). Pulls the
 * same tokens from `useChartTheme` as `TrendLine`, so the swatches always match
 * what's drawn.
 */
function WeeklyTrendLegend({
  showTrend,
  showComparison,
}: WeeklyTrendLegendProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {barFill, trendStroke, comparisonStroke} = useChartTheme();

  return (
    <View
      style={[
        styles.flexRow,
        styles.flexWrap,
        styles.justifyContentCenter,
        {columnGap: 14, rowGap: 6},
      ]}>
      <View style={[styles.flexRow, styles.alignItemsCenter, {columnGap: 6}]}>
        <View
          style={{
            width: 12,
            height: 10,
            borderRadius: 2,
            backgroundColor: barFill,
          }}
        />
        <Text style={[styles.textMicroSupporting]}>
          {translate('statistics.tabs.trends.weeklyTrend.legend.thisPeriod')}
        </Text>
      </View>

      {showTrend ? (
        <View style={[styles.flexRow, styles.alignItemsCenter, {columnGap: 6}]}>
          <View
            style={{
              width: 16,
              height: 2.5,
              borderRadius: 2,
              backgroundColor: trendStroke,
            }}
          />
          <Text style={[styles.textMicroSupporting]}>
            {translate('statistics.tabs.trends.weeklyTrend.legend.trend')}
          </Text>
        </View>
      ) : null}

      {showComparison ? (
        <View style={[styles.flexRow, styles.alignItemsCenter, {columnGap: 6}]}>
          <View
            style={[styles.flexRow, styles.alignItemsCenter, {columnGap: 2}]}>
            <View
              style={{width: 4, height: 2, backgroundColor: comparisonStroke}}
            />
            <View
              style={{width: 4, height: 2, backgroundColor: comparisonStroke}}
            />
            <View
              style={{width: 4, height: 2, backgroundColor: comparisonStroke}}
            />
          </View>
          <Text style={[styles.textMicroSupporting]}>
            {translate('statistics.tabs.trends.comparison.legend')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

WeeklyTrendLegend.displayName = 'WeeklyTrendLegend';

export default WeeklyTrendLegend;
export type {WeeklyTrendLegendProps};
