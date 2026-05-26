import {StyleSheet, View} from 'react-native';
import {ChartCard} from '@components/Charts/ChartCard';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {TranslationPaths} from '@src/languages/types';

const TAB_LABEL_KEYS: readonly TranslationPaths[] = [
  'statistics.tabs.overview.label',
  'statistics.tabs.trends.label',
  'statistics.tabs.patterns.label',
  'statistics.tabs.breakdown.label',
];

const skeletonStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabIndicator: {
    height: 2,
    width: '25%',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

/**
 * Layout-faithful placeholder mirroring the Overview tab — the default
 * landing tab whenever StatisticsScreen mounts. Rendered while
 * `StatisticsTabs` is being dynamically imported in
 * `StatisticsScreen.tsx`. The match-the-destination strategy keeps the
 * visual transition between this skeleton and the real Overview minimal:
 * tab bar gains interactivity + an animated indicator, every body
 * placeholder stays in the same shape because Overview itself starts in
 * its `isLoading` state.
 *
 * Importantly this file does NOT import `react-native-tab-view` or any
 * chart components — only the cheap `ChartSkeleton` primitives and
 * `ChartCard` shell. That keeps the first-frame paint free of
 * Reanimated worklet init and Skia/Victory parsing.
 */
function StatisticsScreenSkeleton() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();

  return (
    <View style={styles.flex1}>
      <View
        style={[
          skeletonStyles.tabBar,
          {
            backgroundColor: theme.appBG,
            borderBottomColor: theme.border,
          },
        ]}>
        {TAB_LABEL_KEYS.map((labelKey, idx) => (
          <View key={labelKey} style={skeletonStyles.tabItem}>
            <Text
              style={[
                skeletonStyles.tabLabel,
                {color: idx === 0 ? theme.text : theme.textSupporting},
              ]}>
              {translate(labelKey)}
            </Text>
          </View>
        ))}
      </View>
      <View
        style={[skeletonStyles.tabIndicator, {backgroundColor: theme.success}]}
      />

      <ScrollView contentContainerStyle={styles.p4}>
        {/* Hero KPI (AF days). */}
        <View style={styles.mb3}>
          <ChartSkeleton variant="kpi" />
        </View>

        {/* Three-card KPI row. */}
        <View style={styles.mb3}>
          <ChartSkeleton variant="kpiRow" />
        </View>

        {/* Calendar heatmap card. */}
        <ChartCard title={translate('statistics.charts.calendarHeatmap.title')}>
          <ChartSkeleton variant="calendar" />
        </ChartCard>

        {/* Mini trend line card. */}
        <ChartCard title={translate('statistics.tabs.overview.trend.title')}>
          <ChartSkeleton variant="line" height={120} />
        </ChartCard>
      </ScrollView>
    </View>
  );
}

StatisticsScreenSkeleton.displayName = 'StatisticsScreenSkeleton';

export default StatisticsScreenSkeleton;
