import React from 'react';
import {View} from 'react-native';
import {ChartCard} from '@components/Charts/ChartCard';
import {DistributionBar} from '@components/Charts/DistributionBar';
import type {DistributionSegment} from '@components/Charts/DistributionBar';
import {KpiCard, KpiCardGroup} from '@components/Charts/KpiCard';
import type {KpiCardProps} from '@components/Charts/KpiCard';
import {PeriodBarList} from '@components/Charts/PeriodBarList';
import ScrollView from '@components/ScrollView';
import StatsFilterToolbar from '@components/Statistics/StatsFilterToolbar';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useOverviewTabData from '@hooks/useStatistics/useOverviewTabData';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

type DeltaShape = NonNullable<KpiCardProps['delta']>;

function formatUnits(value: number): string {
  // 1 decimal for partial units, else integer — matches the other tabs.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Total-alcohol scorecard for the selected range. Reads the shared range +
 * comparison from the toolbar and tells a period story top-to-bottom:
 * verdict (units) → narrative (one plain-language line) → wins (restraint) →
 * load (consumption) → risk (threshold days) → texture (shape + intensity).
 *
 * The hero's old inline sparkline (an axis-less curve with no labels that
 * collapsed to a few points at any range) is replaced by a single computed
 * sentence under the headline number. It names the things a curve never
 * could — units, sessions, and alcohol-free days — so the period reads as a
 * story before the tiles break it down. The labeled "Units by period" bar
 * chart lower in the tab still carries the consumption shape.
 */
function OverviewTab() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  const {
    isLoading,
    hasEverLogged,
    isSparse,
    thresholds,
    current,
    previous,
    subPeriods,
    granularity,
  } = useOverviewTabData();

  // Skip the never-logged copy while loading — the tiles render skeletons.
  if (!isLoading && !hasEverLogged) {
    return (
      <View style={styles.flex1}>
        <StatsFilterToolbar showDrinkTypeFilter={false} />
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
            <Text
              style={[styles.textNormal, styles.textAlignCenter, styles.mt3]}>
              {translate('statistics.tabs.overview.empty.neverLogged.body')}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const vsPrevious = translate('statistics.tabs.overview.delta.vsPrevious');
  const makeDelta = (cur: number, prev: number): DeltaShape | undefined => {
    if (!previous) {
      return undefined;
    }
    const diff = Number((cur - prev).toFixed(1));
    let direction: DeltaShape['direction'] = 'flat';
    if (diff > 0) {
      direction = 'up';
    } else if (diff < 0) {
      direction = 'down';
    }
    return {value: diff, direction, label: vsPrevious};
  };

  const winsCards: KpiCardProps[] = [
    {
      label: translate('statistics.tabs.overview.kpi.afDays.label'),
      value: current.afDays,
      unit: `/${current.elapsedDays}`,
      delta: previous ? makeDelta(current.afDays, previous.afDays) : undefined,
      tone: 'celebratory',
      polarity: 'higher-is-supportive',
    },
    {
      label: translate('statistics.tabs.overview.kpi.dryStreak.label'),
      value: current.longestDryStreak,
      unit: translate('statistics.tabs.overview.kpi.dryStreak.unit'),
      delta: previous
        ? makeDelta(current.longestDryStreak, previous.longestDryStreak)
        : undefined,
      polarity: 'higher-is-supportive',
    },
  ];

  const loadCards: KpiCardProps[] = [
    {
      label: translate('statistics.tabs.overview.kpi.sessions.label'),
      value: current.sessions,
      delta: previous
        ? makeDelta(current.sessions, previous.sessions)
        : undefined,
      polarity: 'lower-is-supportive',
    },
    {
      label: translate('statistics.tabs.overview.kpi.heaviestDay.label'),
      value: formatUnits(current.heaviestDay),
      unit: translate('statistics.tabs.overview.kpi.heaviestDay.unit'),
      delta: previous
        ? makeDelta(current.heaviestDay, previous.heaviestDay)
        : undefined,
      polarity: 'lower-is-supportive',
    },
    {
      label: translate('statistics.tabs.overview.kpi.avgPerDrinkingDay.label'),
      value: formatUnits(current.avgUnitsPerDrinkingDay),
      unit: translate('statistics.tabs.overview.kpi.avgPerDrinkingDay.unit'),
      delta: previous
        ? makeDelta(
            current.avgUnitsPerDrinkingDay,
            previous.avgUnitsPerDrinkingDay,
          )
        : undefined,
      polarity: 'lower-is-supportive',
    },
    {
      label: translate('statistics.tabs.overview.kpi.monthlyAvg.label'),
      value: formatUnits(current.monthlyAvgUnits),
      unit: translate('statistics.tabs.overview.kpi.monthlyAvg.unit'),
      delta: previous
        ? makeDelta(current.monthlyAvgUnits, previous.monthlyAvgUnits)
        : undefined,
      polarity: 'lower-is-supportive',
    },
  ];

  const pctOver =
    current.elapsedDays > 0
      ? Math.round((current.daysOverYellow / current.elapsedDays) * 100)
      : 0;

  const riskCards: KpiCardProps[] = [
    {
      label: translate('statistics.tabs.overview.kpi.daysOverYellow.label', {
        threshold: thresholds.yellow,
      }),
      value: current.daysOverYellow,
      delta: previous
        ? makeDelta(current.daysOverYellow, previous.daysOverYellow)
        : undefined,
      polarity: 'lower-is-supportive',
    },
    {
      label: translate('statistics.tabs.overview.kpi.daysOverOrange.label', {
        threshold: thresholds.orange,
      }),
      value: current.daysOverOrange,
      delta: previous
        ? makeDelta(current.daysOverOrange, previous.daysOverOrange)
        : undefined,
      polarity: 'lower-is-supportive',
    },
    {
      // Percentage is shown without a delta: the current period may be partial
      // while the comparison is fully elapsed, so the day-count deltas above
      // carry the change signal instead.
      label: translate('statistics.tabs.overview.kpi.pctOver.label', {
        threshold: thresholds.yellow,
      }),
      value: `${pctOver}%`,
      polarity: 'neutral',
    },
  ];

  const distribution: DistributionSegment[] = [
    {
      label: translate('statistics.tabs.overview.texture.distribution.af'),
      value: current.distribution.green,
      color: theme.success,
    },
    {
      label: translate('statistics.tabs.overview.texture.distribution.light'),
      value: current.distribution.yellow,
      color: theme.warning,
    },
    {
      label: translate(
        'statistics.tabs.overview.texture.distribution.moderate',
      ),
      value: current.distribution.orange,
      color: theme.add,
    },
    {
      label: translate('statistics.tabs.overview.texture.distribution.heavy'),
      value: current.distribution.red,
      color: theme.danger,
    },
  ];

  const sectionLabel = (key: Parameters<typeof translate>[0]) => (
    <Text style={[styles.textLabelSupporting, styles.textStrong, styles.mb1]}>
      {translate(key)}
    </Text>
  );

  // One plain-language line that frames the period before the tiles break it
  // down. Only shown when there's something to narrate; the all-AF case is
  // covered by the dedicated footer below.
  const showNarrative = !isLoading && current.sessions > 0;

  return (
    <View style={styles.flex1}>
      <StatsFilterToolbar showDrinkTypeFilter={false} />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.p4]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.mb3}>
          <KpiCard
            label={translate('statistics.tabs.overview.hero.label')}
            value={formatUnits(current.totalUnits)}
            unit={translate('statistics.tabs.overview.hero.unit')}
            delta={makeDelta(current.totalUnits, previous?.totalUnits ?? 0)}
            polarity="lower-is-supportive"
            isLoading={isLoading}
          />
          {showNarrative ? (
            <Text
              style={[
                styles.textNormal,
                styles.mt2,
                {color: theme.textSupporting},
              ]}>
              {translate('statistics.tabs.overview.narrative', {
                units: formatUnits(current.totalUnits),
                sessions: current.sessions,
                afDays: current.afDays,
                days: current.elapsedDays,
              })}
            </Text>
          ) : null}
        </View>

        <View style={styles.mb3}>
          {sectionLabel('statistics.tabs.overview.sections.highlights')}
          <KpiCardGroup cards={winsCards} isLoading={isLoading} />
        </View>

        <View style={styles.mb3}>
          {sectionLabel('statistics.tabs.overview.sections.consumption')}
          <KpiCardGroup cards={loadCards} isLoading={isLoading} />
        </View>

        <View style={styles.mb3}>
          {sectionLabel('statistics.tabs.overview.sections.heavyDays')}
          <KpiCardGroup cards={riskCards} isLoading={isLoading} />
        </View>

        <ChartCard
          title={translate('statistics.tabs.overview.texture.series.title')}>
          <PeriodBarList
            points={subPeriods}
            granularity={granularity}
            accessibilityLabel={translate(
              'statistics.tabs.overview.texture.series.a11y',
            )}
            isLoading={isLoading}
          />
        </ChartCard>

        <ChartCard
          title={translate(
            'statistics.tabs.overview.texture.distribution.title',
          )}>
          <DistributionBar
            segments={distribution}
            accessibilityLabel={translate(
              'statistics.tabs.overview.texture.distribution.a11y',
            )}
            isLoading={isLoading}
          />
        </ChartCard>

        {!isLoading && current.sessions === 0 && current.elapsedDays > 0 ? (
          <View style={styles.mt2}>
            <Text style={[styles.textMicroSupporting, styles.textAlignCenter]}>
              {translate('statistics.tabs.overview.empty.noDataInRange')}
            </Text>
          </View>
        ) : null}

        {!isLoading && current.sessions > 0 && isSparse ? (
          <View style={styles.mt2}>
            <Text style={[styles.textMicroSupporting, styles.textAlignCenter]}>
              {translate('statistics.tabs.overview.sparseFooter')}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

OverviewTab.displayName = 'OverviewTab';

export default OverviewTab;
