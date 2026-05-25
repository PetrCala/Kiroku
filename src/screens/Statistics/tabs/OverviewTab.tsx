import React, {useMemo} from 'react';
import {View} from 'react-native';
import ScrollView from '@components/ScrollView';
import {CalendarHeatmap} from '@components/Charts/CalendarHeatmap';
import {ChartCard} from '@components/Charts/ChartCard';
import {KpiCard, KpiCardGroup} from '@components/Charts/KpiCard';
import type {KpiCardProps} from '@components/Charts/KpiCard';
import {MiniTrendLine} from '@components/Charts/MiniTrendLine';
import Text from '@components/Text';
import useDrinkEvents from '@hooks/useStatistics/useDrinkEvents';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {
  selectAfDaysThisMonth,
  selectHasEverLogged,
  selectIsSparse,
  selectThisMonthHeatmapCells,
  selectTrendSeries,
  selectWeeklyKpis,
} from '@libs/Statistics/overviewSelectors';
import type {TranslationPaths} from '@src/languages/types';
import {useStatsDrillDown} from '@src/screens/Statistics/drilldown/DrillDownContext';

type DeltaShape = NonNullable<KpiCardProps['delta']>;

function makeDelta(
  current: number,
  previous: number,
  label: string,
): DeltaShape {
  const diff = current - previous;
  let direction: DeltaShape['direction'] = 'flat';
  if (diff > 0) {
    direction = 'up';
  } else if (diff < 0) {
    direction = 'down';
  }
  return {value: diff, direction, label};
}

function formatUnits(value: number): string {
  // 1 decimal for partial units, else integer — matches existing chart formatting.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function OverviewTab() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  const {events, isLoading} = useDrinkEvents();
  const {openDrillDown} = useStatsDrillDown();

  // Snapshot `now` once per mount so all selectors agree. Re-deriving on each
  // render would let an animation frame land between two reads and disagree
  // about today's date.
  const now = useMemo(() => new Date(), []);

  const afDays = useMemo(
    () => selectAfDaysThisMonth(events, now),
    [events, now],
  );
  const weekly = useMemo(() => selectWeeklyKpis(events, now), [events, now]);
  const trend = useMemo(() => selectTrendSeries(events, now), [events, now]);
  const cells = useMemo(
    () => selectThisMonthHeatmapCells(events, now),
    [events, now],
  );

  const hasEverLogged = selectHasEverLogged(events);
  const isSparse = selectIsSparse(events, trend.weeksWithData);

  // Don't paint anything in the brief Onyx-hydration window — the
  // alternative is a flicker from "never logged" copy into the real screen.
  if (isLoading) {
    return <View style={styles.flex1} />;
  }

  if (!hasEverLogged) {
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.p4, styles.alignItemsCenter]}>
        <View style={[styles.p4, styles.alignItemsCenter]}>
          <Text
            style={[
              styles.textHeadline,
              styles.textAlignCenter,
              {color: theme.successHover},
            ]}>
            {translate('statistics.tabs.overview.empty.neverLogged.title')}
          </Text>
          <Text style={[styles.textNormal, styles.textAlignCenter, styles.mt3]}>
            {translate('statistics.tabs.overview.empty.neverLogged.body')}
          </Text>
        </View>
      </ScrollView>
    );
  }

  const sessionsDelta = makeDelta(
    weekly.sessionsThisWeek,
    weekly.sessionsLastWeek,
    translate('statistics.tabs.overview.kpi.sessionsThisWeek.delta'),
  );
  const quietDelta = makeDelta(
    weekly.quietDaysThisWeek,
    weekly.quietDaysLastWeek,
    translate('statistics.tabs.overview.kpi.quietDaysThisWeek.delta'),
  );
  const unitsDelta = makeDelta(
    weekly.unitsThisWeek,
    weekly.unitsLastWeek,
    translate('statistics.tabs.overview.kpi.unitsThisWeek.delta'),
  );

  let trendChipKey: TranslationPaths =
    'statistics.tabs.overview.trend.chip.none';
  if (trend.mannKendall.trend === 'down') {
    trendChipKey = 'statistics.tabs.overview.trend.chip.down';
  } else if (trend.mannKendall.trend === 'up') {
    trendChipKey = 'statistics.tabs.overview.trend.chip.up';
  }

  const kpiCards: KpiCardProps[] = [
    {
      label: translate('statistics.tabs.overview.kpi.sessionsThisWeek.label'),
      value: weekly.sessionsThisWeek,
      delta: sessionsDelta,
      polarity: 'lower-is-supportive',
    },
    {
      label: translate('statistics.tabs.overview.kpi.quietDaysThisWeek.label'),
      value: weekly.quietDaysThisWeek,
      delta: quietDelta,
      polarity: 'higher-is-supportive',
    },
    {
      label: translate('statistics.tabs.overview.kpi.unitsThisWeek.label'),
      value: formatUnits(weekly.unitsThisWeek),
      delta: {...unitsDelta, value: Number(unitsDelta.value.toFixed(1))},
      polarity: 'lower-is-supportive',
    },
  ];

  const heroA11y = translate('statistics.tabs.overview.hero.afDays.a11yLabel', {
    value: afDays.value,
    total: afDays.total,
  });

  return (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.p4]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.mb3}>
        <KpiCard
          label={translate('statistics.tabs.overview.hero.afDays.label')}
          value={afDays.value}
          unit={`/${afDays.total}`}
          tone="celebratory"
          polarity="higher-is-supportive"
          accessibilityLabel={heroA11y}
        />
      </View>

      <View style={styles.mb3}>
        <KpiCardGroup cards={kpiCards} />
      </View>

      <ChartCard title={translate('statistics.charts.calendarHeatmap.title')}>
        <CalendarHeatmap
          cells={cells}
          accessibilityLabel={translate(
            'statistics.charts.calendarHeatmap.title',
          )}
          onDayPress={cell => openDrillDown({kind: 'day', date: cell.dateKey})}
        />
      </ChartCard>

      <ChartCard
        title={translate('statistics.tabs.overview.trend.title')}
        footer={
          <Text style={[styles.textMicroSupporting]}>
            {translate('statistics.tabs.overview.trend.bandCaption')}
          </Text>
        }>
        <MiniTrendLine
          points={trend.points}
          band={trend.band}
          ewma={trend.ewma}
          height={120}
          accessibilityLabel={translate(
            'statistics.tabs.overview.trend.a11yLabel',
          )}
        />
      </ChartCard>

      <View style={[styles.mt2, styles.mb2]}>
        <Text style={[styles.textLabelSupporting, styles.textAlignCenter]}>
          {translate(trendChipKey)}
        </Text>
      </View>

      {isSparse ? (
        <View style={styles.mt2}>
          {weekly.quietDaysThisWeek > 0 ? (
            <Text
              style={[
                styles.textMicroSupporting,
                styles.textAlignCenter,
                styles.mb2,
              ]}>
              {translate('statistics.tabs.overview.empty.noDataInWindow', {
                quietDays: weekly.quietDaysThisWeek,
              })}
            </Text>
          ) : null}
          <Text style={[styles.textMicroSupporting, styles.textAlignCenter]}>
            {translate('statistics.tabs.overview.sparseFooter')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

OverviewTab.displayName = 'OverviewTab';

export default OverviewTab;
