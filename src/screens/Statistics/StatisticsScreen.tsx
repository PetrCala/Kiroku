import {View} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import {CalendarHeatmap} from '@components/Charts/CalendarHeatmap';
import {ChartCard} from '@components/Charts/ChartCard';
import {KpiCardGroup} from '@components/Charts/KpiCard';
import type {KpiCardProps} from '@components/Charts/KpiCard';
import {WeeklyBars} from '@components/Charts/WeeklyBars';
import useCalendarHeatmap from '@hooks/useStatistics/useCalendarHeatmap';
import useKpis from '@hooks/useStatistics/useKpis';
import useWeeklyBars from '@hooks/useStatistics/useWeeklyBars';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {KpiKey, KpiValue} from '@libs/Statistics';
import type {TranslationPaths} from '@src/languages/types';

// Explicit map keeps `translate(...)` typed against the literal-union of
// TranslationPaths rather than a constructed-template string.
const KPI_LABEL_KEYS: Record<KpiKey, TranslationPaths> = {
  alcoholFreeDays: 'statistics.kpi.alcoholFreeDays',
  sessionsThisWeek: 'statistics.kpi.sessionsThisWeek',
  avgUnitsPerSession: 'statistics.kpi.avgUnitsPerSession',
  totalUnitsThisWeek: 'statistics.kpi.totalUnitsThisWeek',
};

const COMPARISON_KEYS: Record<
  NonNullable<KpiValue['delta']>['comparisonKey'],
  TranslationPaths
> = {
  vsLastWeek: 'statistics.kpi.vsLastWeek',
  vsLastMonth: 'statistics.kpi.vsLastMonth',
};

function StatisticsScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const kpis = useKpis();
  const heatmap = useCalendarHeatmap();
  const weekly = useWeeklyBars();

  const isLoading = kpis.isLoading || heatmap.isLoading || weekly.isLoading;
  const isEmpty = !isLoading && kpis.isEmpty;

  const cards: KpiCardProps[] = kpis.data.map(kpi => ({
    label: translate(KPI_LABEL_KEYS[kpi.key]),
    value: kpi.value,
    delta: kpi.delta
      ? {
          value: kpi.delta.value,
          direction: kpi.delta.direction,
          label: translate(COMPARISON_KEYS[kpi.delta.comparisonKey]),
        }
      : undefined,
  }));

  let body;
  if (isLoading) {
    body = (
      <View style={[styles.flex1, styles.alignItemsCenter, styles.pv5]}>
        <Text style={styles.textSupporting}>
          {translate('statistics.loading.title')}
        </Text>
      </View>
    );
  } else if (isEmpty) {
    body = (
      <View
        style={[
          styles.flex1,
          styles.alignItemsCenter,
          styles.justifyContentCenter,
          styles.ph4,
        ]}>
        <Text style={[styles.textHeadline, styles.mb2]}>
          {translate('statistics.empty.title')}
        </Text>
        <Text style={[styles.textSupporting, styles.textAlignCenter]}>
          {translate('statistics.empty.body')}
        </Text>
      </View>
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.ph4}>
        <KpiCardGroup cards={cards} />
        <ChartCard title={translate('statistics.charts.calendarHeatmap.title')}>
          <CalendarHeatmap
            cells={heatmap.data}
            accessibilityLabel={translate('statistics.a11y.calendarHeatmap')}
          />
        </ChartCard>
        <ChartCard title={translate('statistics.charts.weeklyBars.title')}>
          <WeeklyBars
            bars={weekly.data.bars}
            band={weekly.data.band}
            accessibilityLabel={translate('statistics.a11y.weeklyBars')}
          />
        </ChartCard>
      </ScrollView>
    );
  }

  return (
    <ScreenWrapper testID={StatisticsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('statistics.title')}
        onBackButtonPress={Navigation.goBack}
      />
      {body}
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';
export default StatisticsScreen;
