import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChartCard} from '@components/Charts/ChartCard';
import {CumulativeLine} from '@components/Charts/CumulativeLine';
import {StackedArea} from '@components/Charts/StackedArea';
import {TrendLine} from '@components/Charts/TrendLine';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTrendsTabData from '@hooks/useStatistics/useTrendsTabData';
import useThemeStyles from '@hooks/useThemeStyles';
import type {TranslationPaths} from '@src/languages/types';

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

  if (isLoading) {
    return (
      <View style={[styles.container, themeStyles.justifyContentCenter]}>
        <Text style={[themeStyles.textSupporting, themeStyles.textAlignCenter]}>
          {translate('common.loading')}
        </Text>
      </View>
    );
  }

  const heroComparisonShown = !!hero.comparison;
  const heroSubtitle = hero.band
    ? translate('statistics.tabs.trends.weeklyTrend.bandCaption')
    : undefined;
  const heroCaption = translate(CAPTION_KEYS[hero.captionKey]);
  const comparisonLegend = translate(
    'statistics.tabs.trends.comparison.legend',
  );

  return (
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
        />
      </ChartCard>
    </ScrollView>
  );
}

TrendsTab.displayName = 'TrendsTab';

export default TrendsTab;
