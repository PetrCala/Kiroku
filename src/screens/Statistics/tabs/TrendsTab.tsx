import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {AfRateLine} from '@components/Charts/AfRateLine';
import {ChartCard} from '@components/Charts/ChartCard';
import {StackedArea} from '@components/Charts/StackedArea';
import {TrendLine, WeeklyTrendLegend} from '@components/Charts/TrendLine';
import ScrollView from '@components/ScrollView';
import StatsFilterToolbar from '@components/Statistics/StatsFilterToolbar';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTrendsTabData from '@hooks/useStatistics/useTrendsTabData';
import useThemeStyles from '@hooks/useThemeStyles';
import {DRINK_KEY_ORDER} from '@libs/Statistics/drinkKeyMeta';
import type {TranslationPaths} from '@src/languages/types';
import {useStatsDrillDown} from '@src/screens/Statistics/drilldown/DrillDownContext';
import DrinkTypeLegend from './breakdown/DrinkTypeLegend';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
});

const CAPTION_KEYS: Record<string, TranslationPaths> = {
  trendingUp: 'statistics.tabs.trends.weeklyTrend.captions.trendingUp',
  trendingDown: 'statistics.tabs.trends.weeklyTrend.captions.trendingDown',
  neutral: 'statistics.tabs.trends.weeklyTrend.captions.neutral',
  notEnoughData: 'statistics.tabs.trends.weeklyTrend.captions.notEnoughData',
};

function TrendsTab() {
  const {translate} = useLocalize();
  const themeStyles = useThemeStyles();
  const {hero, afRate, stack, isLoading} = useTrendsTabData();
  const {openDrillDown} = useStatsDrillDown();

  const heroComparisonShown = !!hero.comparison;
  // The trend line only draws once EWMA exists (≥4 weeks); the legend mirrors it.
  const heroShowTrend = !!hero.ewma && hero.ewma.length === hero.weeks.length;
  const heroCaption = translate(CAPTION_KEYS[hero.captionKey]);
  const comparisonLegend = translate(
    'statistics.tabs.trends.comparison.legend',
  );

  // Legend lists only the drink types actually stacked, in canonical order.
  const trendsLegendEntries = useMemo(
    () =>
      DRINK_KEY_ORDER.filter(key => stack.trackedKeys.includes(key)).map(
        key => ({key}),
      ),
    [stack.trackedKeys],
  );

  return (
    <View style={themeStyles.flex1}>
      <StatsFilterToolbar />
      <ScrollView
        style={themeStyles.flex1}
        contentContainerStyle={styles.container}>
        <ChartCard
          title={translate('statistics.tabs.trends.weeklyTrend.title')}
          footer={
            <WeeklyTrendLegend
              showTrend={heroShowTrend}
              showComparison={heroComparisonShown}
            />
          }>
          <TrendLine
            weeks={hero.weeks}
            units={hero.units}
            ewma={hero.ewma}
            comparison={hero.comparison}
            emptyLabel={translate(
              'statistics.tabs.trends.weeklyTrend.emptyLabel',
            )}
            accessibilityLabel={heroCaption}
            onWeekPress={isoWeek => openDrillDown({kind: 'isoWeek', isoWeek})}
            isLoading={isLoading}
          />
        </ChartCard>

        {afRate.hidden ? null : (
          <ChartCard
            title={translate('statistics.tabs.trends.afRate.title')}
            footer={
              afRate.comparisonPoints ? (
                <Text style={themeStyles.textMicroSupporting}>
                  {comparisonLegend}
                </Text>
              ) : undefined
            }>
            <AfRateLine
              points={afRate.points}
              comparisonPoints={afRate.comparisonPoints}
              emptyLabel={translate('statistics.tabs.trends.afRate.emptyLabel')}
              accessibilityLabel={translate(
                'statistics.tabs.trends.afRate.title',
              )}
              isLoading={isLoading}
            />
          </ChartCard>
        )}

        <ChartCard
          title={translate('statistics.tabs.trends.drinkTypeStack.title')}
          footer={
            trendsLegendEntries.length > 0 || stack.comparisonTotal ? (
              <View style={{rowGap: 8}}>
                <DrinkTypeLegend
                  variant="trends"
                  entries={trendsLegendEntries}
                />
                {stack.comparisonTotal ? (
                  <Text style={themeStyles.textMicroSupporting}>
                    {comparisonLegend}
                  </Text>
                ) : null}
              </View>
            ) : undefined
          }>
          <StackedArea
            weeks={stack.weeks}
            byKey={stack.byKey}
            trackedKeys={stack.trackedKeys}
            palette={stack.palette}
            comparisonTotal={stack.comparisonTotal}
            emptyLabel={translate(
              'statistics.tabs.trends.drinkTypeStack.emptyLabel',
            )}
            accessibilityLabel={translate(
              'statistics.tabs.trends.drinkTypeStack.title',
            )}
            isLoading={isLoading}
          />
        </ChartCard>
      </ScrollView>
    </View>
  );
}

TrendsTab.displayName = 'TrendsTab';

export default TrendsTab;
