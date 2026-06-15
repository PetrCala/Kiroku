import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import ScrollView from '@components/ScrollView';
import {DowHourHeatmap} from '@components/Charts/DowHourHeatmap';
import {Histogram} from '@components/Charts/Histogram';
import type {HistogramBin} from '@components/Charts/Histogram';
import {HourPolar} from '@components/Charts/HourPolar';
import {ChartCard} from '@components/Charts/ChartCard';
import StatsFilterToolbar from '@components/Statistics/StatsFilterToolbar';
import Text from '@components/Text';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
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
  liveSessionsOnly,
  percentile,
  sessionDurationMin,
  sumUnits,
} from '@libs/Statistics';
import type {WeekStart} from '@libs/Statistics';
import {useStatsDrillDown} from '@src/screens/Statistics/drilldown/DrillDownContext';

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

// Compact upper-bound labels so all five fit the half-width histogram cell
// (e.g. "1h" = the 30–60m bin). The full ranges live in the bin definitions.
const DURATION_BIN_LABELS = ['30m', '1h', '2h', '4h', '4h+'] as const;

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
  const {range, drinkTypeFilter, liveOnly, userIds} = useStatsContext();
  const preferences = useCurrentUserPreferences();
  const {events, isLoading} = useDrinkEvents(
    userIds.length > 0 ? [...userIds] : undefined,
  );
  const {translate} = useLocalize();
  const themeStyles = useThemeStyles();
  const {openDrillDown} = useStatsDrillDown();

  const weekStart = resolveWeekStart(preferences?.first_day_of_week);

  const eventFilter = useMemo(
    () =>
      composeFilters(
        dateRange(range.start.getTime(), range.end.getTime()),
        drinkTypeFilter.size > 0 ? drinkTypeSubset(drinkTypeFilter) : undefined,
      ),
    [range, drinkTypeFilter],
  );

  // Timing-derived charts (hour-of-day, dow×hour, session duration) honor the
  // tab-level "Live only" toggle: edit/manually-logged sessions carry synthetic
  // per-drink timestamps AND a fixed zero duration (start_time === end_time, no
  // UI to set an end), so they're noise here. Drinks-per-session keeps the plain
  // `eventFilter` — a drink count is meaningful for any session type.
  const timeFilter = useMemo(
    () => composeFilters(eventFilter, liveOnly ? liveSessionsOnly : undefined),
    [eventFilter, liveOnly],
  );

  const hourBuckets = useAggregate(events, byHour, sumUnits, timeFilter);
  const dowHourBuckets = useAggregate(
    events,
    composeBuckets(byDow, byHour),
    sumUnits,
    timeFilter,
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
    timeFilter,
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
    <View style={themeStyles.flex1}>
      <StatsFilterToolbar showSessionTypeToggle />
      <ScrollView
        style={[styles.scroll, {backgroundColor: undefined}]}
        contentContainerStyle={styles.scrollContent}>
        <ChartCard title={translate('statistics.charts.hourOfDay.title')}>
          <HourPolar
            buckets={hourBuckets}
            accessibilityLabel={translate('statistics.charts.hourOfDay.title')}
            emptyLabel={translate('statistics.charts.hourOfDay.empty')}
            onSpokePress={hour => openDrillDown({kind: 'hour', hour})}
            isLoading={isLoading}
          />
        </ChartCard>
        <ChartCard title={translate('statistics.charts.dowHour.title')}>
          <DowHourHeatmap
            buckets={dowHourBuckets}
            weekStart={weekStart}
            accessibilityLabel={translate('statistics.charts.dowHour.title')}
            emptyLabel={translate('statistics.charts.dowHour.empty')}
            isLoading={isLoading}
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
                emptyLabel={translate(
                  'statistics.charts.drinksPerSession.empty',
                )}
                height={160}
                isLoading={isLoading}
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
                emptyLabel={translate(
                  'statistics.charts.sessionDuration.empty',
                )}
                height={160}
                isLoading={isLoading}
              />
            </ChartCard>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

PatternsTab.displayName = 'PatternsTab';

export default PatternsTab;
