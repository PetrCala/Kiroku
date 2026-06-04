import React, {useMemo} from 'react';
import {View} from 'react-native';
import ScrollView from '@components/ScrollView';
import ChartCard from '@components/Charts/ChartCard/ChartCard';
import StatsFilterToolbar from '@components/Statistics/StatsFilterToolbar';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useStatsContext from '@hooks/useStatsContext';
import {useAggregate, useDrinkEvents} from '@hooks/useStatistics';
import useThemeStyles from '@hooks/useThemeStyles';
import {
  byDrinkKey,
  byIsoWeek,
  composeBuckets,
  dateRange,
  sumUnits,
} from '@libs/Statistics';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import {useStatsDrillDown} from '@src/screens/Statistics/drilldown/DrillDownContext';
import DrinkTypeDonut from './breakdown/DrinkTypeDonut';
import PerTypeWeeklyMultiples from './breakdown/PerTypeWeeklyMultiples';
import TypeConcentrationSentence from './breakdown/TypeConcentrationSentence';

const drinkKeyByIsoWeek = composeBuckets(byDrinkKey, byIsoWeek);
const COMPARISON_DONUT_SIZE = 150;
// Matches no events — keeps the comparison aggregate hooks unconditional while
// yielding empty maps when Compare is off.
const EMPTY_FILTER = dateRange(0, -1);

function BreakdownTab() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {range, comparisonRange, drinkTypeFilter, userIds} = useStatsContext();
  const {openDrillDown} = useStatsDrillDown();
  const {events, isLoading} = useDrinkEvents(
    userIds.length > 0 ? [...userIds] : undefined,
  );

  const showComparison = comparisonRange !== null;

  const currentFilter = useMemo(
    () => dateRange(range.start.getTime(), range.end.getTime()),
    [range.start, range.end],
  );
  const comparisonFilter = useMemo(
    () =>
      comparisonRange
        ? dateRange(
            comparisonRange.start.getTime(),
            comparisonRange.end.getTime(),
          )
        : EMPTY_FILTER,
    [comparisonRange],
  );

  const currentUnitsByDrinkKey = useAggregate<DrinkKey, number>(
    events,
    byDrinkKey,
    sumUnits,
    currentFilter,
  );
  const comparisonUnitsByDrinkKey = useAggregate<DrinkKey, number>(
    events,
    byDrinkKey,
    sumUnits,
    comparisonFilter,
  );
  const unitsByDrinkKeyAndWeek = useAggregate<string, number>(
    events,
    drinkKeyByIsoWeek,
    sumUnits,
    currentFilter,
  );
  const comparisonUnitsByDrinkKeyAndWeek = useAggregate<string, number>(
    events,
    drinkKeyByIsoWeek,
    sumUnits,
    comparisonFilter,
  );

  return (
    <View style={styles.flex1}>
      <StatsFilterToolbar />
      <ScrollView contentContainerStyle={[styles.p3, styles.pb5]}>
        <ChartCard
          title={translate('statistics.tabs.breakdown.donut.title')}
          subtitle={translate('statistics.tabs.breakdown.donut.subtitle')}>
          {showComparison ? (
            <View style={[styles.flexRow, styles.justifyContentCenter]}>
              <View style={styles.alignItemsCenter}>
                <DrinkTypeDonut
                  unitsByDrinkKey={currentUnitsByDrinkKey}
                  drinkTypeFilter={drinkTypeFilter}
                  size={COMPARISON_DONUT_SIZE}
                  onSlicePress={drinkKey =>
                    openDrillDown({kind: 'drinkType', drinkKey})
                  }
                  isLoading={isLoading}
                />
                <Text style={[styles.textMicroSupporting, styles.mt1]}>
                  {translate('statistics.tabs.breakdown.donut.current')}
                </Text>
              </View>
              <View style={[styles.alignItemsCenter, styles.ml3]}>
                <DrinkTypeDonut
                  unitsByDrinkKey={comparisonUnitsByDrinkKey}
                  drinkTypeFilter={drinkTypeFilter}
                  size={COMPARISON_DONUT_SIZE}
                  isLoading={isLoading}
                />
                <Text style={[styles.textMicroSupporting, styles.mt1]}>
                  {translate('statistics.tabs.breakdown.donut.previous')}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.alignItemsCenter}>
              <DrinkTypeDonut
                unitsByDrinkKey={currentUnitsByDrinkKey}
                drinkTypeFilter={drinkTypeFilter}
                onSlicePress={drinkKey =>
                  openDrillDown({kind: 'drinkType', drinkKey})
                }
                isLoading={isLoading}
              />
            </View>
          )}
        </ChartCard>

        <ChartCard
          title={translate('statistics.tabs.breakdown.multiples.title')}
          subtitle={translate('statistics.tabs.breakdown.multiples.subtitle')}>
          <PerTypeWeeklyMultiples
            unitsByDrinkKeyAndWeek={unitsByDrinkKeyAndWeek}
            drinkTypeFilter={drinkTypeFilter}
            rangeStart={range.start}
            rangeEnd={range.end}
            comparisonByDrinkKeyAndWeek={
              showComparison ? comparisonUnitsByDrinkKeyAndWeek : undefined
            }
            comparisonStart={comparisonRange?.start}
            comparisonEnd={comparisonRange?.end}
            isLoading={isLoading}
          />
        </ChartCard>

        {showComparison ? (
          <TypeConcentrationSentence
            currentUnitsByDrinkKey={currentUnitsByDrinkKey}
            priorUnitsByDrinkKey={comparisonUnitsByDrinkKey}
            preset={range.preset}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

BreakdownTab.displayName = 'BreakdownTab';

export default BreakdownTab;
