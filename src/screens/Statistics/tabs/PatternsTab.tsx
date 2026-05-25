import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import ScrollView from '@components/ScrollView';
import {DowHourHeatmap} from '@components/Charts/DowHourHeatmap';
import {Histogram} from '@components/Charts/Histogram';
import type {HistogramBin} from '@components/Charts/Histogram';
import {HourPolar} from '@components/Charts/HourPolar';
import {ChartCard} from '@components/Charts/ChartCard';
import Text from '@components/Text';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useLocalize from '@hooks/useLocalize';
import useStatsContext from '@hooks/useStatsContext';
import {useAggregate, useDrinkEvents} from '@hooks/useStatistics';
import useThemeStyles from '@hooks/useThemeStyles';
import {
  byHour,
  bySessionId,
  byDow,
  composeBuckets,
  composeFilters,
  countEvents,
  dateRange,
  drinkTypeSubset,
  percentile,
  sessionDurationMin,
  sumUnits,
} from '@libs/Statistics';
import type {WeekStart} from '@libs/Statistics';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  histogramRow: {
    flexDirection: 'row',
    gap: 8,
  },
  histogramCell: {
    flex: 1,
  },
});

const WEEK_START_BY_LABEL: Record<string, WeekStart> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const DEFAULT_WEEK_START: WeekStart = 1;

function resolveWeekStart(label: string | undefined): WeekStart {
  if (!label) {
    return DEFAULT_WEEK_START;
  }
  return WEEK_START_BY_LABEL[label] ?? DEFAULT_WEEK_START;
}

const DRINK_BIN_LABELS = ['1', '2', '3', '4', '5+'] as const;

function binDrinksPerSession(values: number[]): HistogramBin[] {
  const counts = [0, 0, 0, 0, 0];
  for (const v of values) {
    if (v <= 0) {
      continue;
    }
    if (v >= 5) {
      counts[4] += 1;
    } else {
      counts[Math.floor(v) - 1] += 1;
    }
  }
  return DRINK_BIN_LABELS.map((label, i) => ({label, count: counts[i]}));
}

const DURATION_BIN_LABELS = ['0–30m', '30–60m', '1–2h', '2–4h', '4h+'] as const;

function binSessionDuration(minutes: number[]): HistogramBin[] {
  const counts = [0, 0, 0, 0, 0];
  for (const m of minutes) {
    if (!Number.isFinite(m) || m < 0) {
      continue;
    }
    if (m < 30) {
      counts[0] += 1;
    } else if (m < 60) {
      counts[1] += 1;
    } else if (m < 120) {
      counts[2] += 1;
    } else if (m < 240) {
      counts[3] += 1;
    } else {
      counts[4] += 1;
    }
  }
  return DURATION_BIN_LABELS.map((label, i) => ({label, count: counts[i]}));
}

function formatDurationMin(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0m';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

function PatternsTab() {
  const {range, drinkTypeFilter, userIds} = useStatsContext();
  const {preferences} = useDatabaseData();
  const {events} = useDrinkEvents(
    userIds.length > 0 ? [...userIds] : undefined,
  );
  const {translate} = useLocalize();
  const themeStyles = useThemeStyles();

  const weekStart = resolveWeekStart(preferences?.first_day_of_week);

  const eventFilter = useMemo(
    () =>
      composeFilters(
        dateRange(range.start.getTime(), range.end.getTime()),
        drinkTypeFilter.size > 0 ? drinkTypeSubset(drinkTypeFilter) : undefined,
      ),
    [range, drinkTypeFilter],
  );

  const hourBuckets = useAggregate(events, byHour, sumUnits, eventFilter);
  const dowHourBuckets = useAggregate(
    events,
    composeBuckets(byDow, byHour),
    sumUnits,
    eventFilter,
  );
  const perSessionCounts = useAggregate(
    events,
    bySessionId,
    countEvents,
    eventFilter,
  );
  const perSessionDuration = useAggregate(
    events,
    bySessionId,
    sessionDurationMin,
    eventFilter,
  );

  const drinkBins = useMemo(
    () => binDrinksPerSession([...perSessionCounts.values()]),
    [perSessionCounts],
  );

  const durationSeries = useMemo(
    () => [...perSessionDuration.values()].filter(Number.isFinite),
    [perSessionDuration],
  );

  const durationBins = useMemo(
    () => binSessionDuration(durationSeries),
    [durationSeries],
  );

  // Quantile copy only renders once there's a meaningful sample (>=4) — under
  // that, a p75 is just the max and the copy reads as a tautology.
  const drinkP75 =
    perSessionCounts.size >= 4
      ? percentile([...perSessionCounts.values()], 0.75)
      : null;
  const durationP75 =
    durationSeries.length >= 4 ? percentile(durationSeries, 0.75) : null;

  return (
    <ScrollView
      style={[styles.scroll, {backgroundColor: undefined}]}
      contentContainerStyle={styles.scrollContent}>
      <ChartCard title={translate('statistics.charts.hourOfDay.title')}>
        <HourPolar
          buckets={hourBuckets}
          accessibilityLabel={translate('statistics.charts.hourOfDay.title')}
          onSpokePress={() => {
            // Drill-down handler — v2-K wires this to StatsDrillDownSheet.
          }}
        />
      </ChartCard>
      <ChartCard title={translate('statistics.charts.dowHour.title')}>
        <DowHourHeatmap
          buckets={dowHourBuckets}
          weekStart={weekStart}
          accessibilityLabel={translate('statistics.charts.dowHour.title')}
        />
      </ChartCard>
      <View style={styles.histogramRow}>
        <View style={styles.histogramCell}>
          <ChartCard
            title={translate('statistics.charts.drinksPerSession.title')}
            footer={
              drinkP75 !== null ? (
                <Text style={[themeStyles.textMicroSupporting]}>
                  {translate('statistics.charts.drinksPerSession.p75Copy', {
                    value: Math.round(drinkP75),
                  })}
                </Text>
              ) : null
            }>
            <Histogram
              bins={drinkBins}
              accessibilityLabel={translate(
                'statistics.charts.drinksPerSession.title',
              )}
              emptyLabel={translate('statistics.charts.drinksPerSession.empty')}
              height={160}
            />
          </ChartCard>
        </View>
        <View style={styles.histogramCell}>
          <ChartCard
            title={translate('statistics.charts.sessionDuration.title')}
            footer={
              durationP75 !== null ? (
                <Text style={[themeStyles.textMicroSupporting]}>
                  {translate('statistics.charts.sessionDuration.p75Copy', {
                    value: formatDurationMin(durationP75),
                  })}
                </Text>
              ) : null
            }>
            <Histogram
              bins={durationBins}
              accessibilityLabel={translate(
                'statistics.charts.sessionDuration.title',
              )}
              emptyLabel={translate('statistics.charts.sessionDuration.empty')}
              height={160}
            />
          </ChartCard>
        </View>
      </View>
    </ScrollView>
  );
}

PatternsTab.displayName = 'PatternsTab';

export default PatternsTab;
