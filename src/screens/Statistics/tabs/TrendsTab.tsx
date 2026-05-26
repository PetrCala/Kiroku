import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChartCard} from '@components/Charts/ChartCard';
import {CumulativeLine} from '@components/Charts/CumulativeLine';
import {StackedArea} from '@components/Charts/StackedArea';
import {TrendLine} from '@components/Charts/TrendLine';
import ScrollView from '@components/ScrollView';
import StatsFilterToolbar from '@components/Statistics/StatsFilterToolbar';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTrendsTabData from '@hooks/useStatistics/useTrendsTabData';
import useThemeStyles from '@hooks/useThemeStyles';
import type {TranslationPaths} from '@src/languages/types';
import {useStatsDrillDown} from '@src/screens/Statistics/drilldown/DrillDownContext';

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  const {hero, afYtd, stack, isLoading} = useTrendsTabData();
  const {openDrillDown} = useStatsDrillDown();

  const heroComparisonShown = !!hero.comparison;
  const heroSubtitle = hero.band
    ? translate('statistics.tabs.trends.weeklyTrend.bandCaption')
    : undefined;
  const heroCaption = translate(CAPTION_KEYS[hero.captionKey]);
  const comparisonLegend = translate(
    'statistics.tabs.trends.comparison.legend',
  );

  return (
    <View style={themeStyles.flex1}>
      <StatsFilterToolbar />
      <ScrollView
        style={themeStyles.flex1}
        contentContainerStyle={styles.container}>
        <ChartCard
          title={translate('statistics.tabs.trends.weeklyTrend.title')}
          subtitle={heroSubtitle}
          footer={
            <Text style={themeStyles.textMicroSupporting}>
              {heroComparisonShown
                ? `${heroCaption} · ${comparisonLegend}`
                : heroCaption}
            </Text>
          }>
          <TrendLine
            weeks={hero.weeks}
            units={hero.units}
            ewma={hero.ewma}
            comparison={hero.comparison}
            band={hero.band}
            emptyLabel={translate(
              'statistics.tabs.trends.weeklyTrend.emptyLabel',
            )}
            accessibilityLabel={heroCaption}
            onWeekPress={isoWeek => openDrillDown({kind: 'isoWeek', isoWeek})}
            isLoading={isLoading}
          />
        </ChartCard>

        {afYtd.hidden ? null : (
          <ChartCard
            title={translate('statistics.tabs.trends.cumulativeAf.title')}
            footer={
              afYtd.comparisonPoints ? (
                <Text style={themeStyles.textMicroSupporting}>
                  {comparisonLegend}
                </Text>
              ) : undefined
            }>
            <CumulativeLine
              points={afYtd.points}
              comparisonPoints={afYtd.comparisonPoints}
              emptyLabel={translate(
                'statistics.tabs.trends.cumulativeAf.emptyLabel',
              )}
              accessibilityLabel={translate(
                'statistics.tabs.trends.cumulativeAf.title',
              )}
              isLoading={isLoading}
            />
          </ChartCard>
        )}

        <ChartCard
          title={translate('statistics.tabs.trends.drinkTypeStack.title')}
          footer={
            stack.comparisonTotal ? (
              <Text style={themeStyles.textMicroSupporting}>
                {comparisonLegend}
              </Text>
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
