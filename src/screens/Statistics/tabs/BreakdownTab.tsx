import React, {useMemo} from 'react';
import {View} from 'react-native';
import ScrollView from '@components/ScrollView';
import ChartCard from '@components/Charts/ChartCard/ChartCard';
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
import DrinkTypeDonut from './breakdown/DrinkTypeDonut';
import PerTypeWeeklyMultiples from './breakdown/PerTypeWeeklyMultiples';
import TypeConcentrationSentence from './breakdown/TypeConcentrationSentence';

const drinkKeyByIsoWeek = composeBuckets(byDrinkKey, byIsoWeek);

function BreakdownTab() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {range, drinkTypeFilter, userIds} = useStatsContext();
  const {events} = useDrinkEvents(
    userIds.length > 0 ? [...userIds] : undefined,
  );

  const currentStartMs = range.start.getTime();
  const currentEndMs = range.end.getTime();
  const priorEndMs = currentStartMs - 1;
  const priorStartMs = currentStartMs - (currentEndMs - currentStartMs) - 1;

  const currentFilter = useMemo(
    () => dateRange(currentStartMs, currentEndMs),
    [currentStartMs, currentEndMs],
  );
  const priorFilter = useMemo(
    () => dateRange(priorStartMs, priorEndMs),
    [priorStartMs, priorEndMs],
  );

  const currentUnitsByDrinkKey = useAggregate<DrinkKey, number>(
    events,
    byDrinkKey,
    sumUnits,
    currentFilter,
  );
  const priorUnitsByDrinkKey = useAggregate<DrinkKey, number>(
    events,
    byDrinkKey,
    sumUnits,
    priorFilter,
  );
  const unitsByDrinkKeyAndWeek = useAggregate<string, number>(
    events,
    drinkKeyByIsoWeek,
    sumUnits,
    currentFilter,
  );

  return (
    <ScrollView contentContainerStyle={[styles.p3, styles.pb5]}>
      <ChartCard
        title={translate('statistics.tabs.breakdown.donut.title')}
        subtitle={translate('statistics.tabs.breakdown.donut.subtitle')}>
        <View style={styles.alignItemsCenter}>
          <DrinkTypeDonut
            unitsByDrinkKey={currentUnitsByDrinkKey}
            drinkTypeFilter={drinkTypeFilter}
          />
        </View>
      </ChartCard>

      <ChartCard
        title={translate('statistics.tabs.breakdown.multiples.title')}
        subtitle={translate('statistics.tabs.breakdown.multiples.subtitle')}>
        <PerTypeWeeklyMultiples
          unitsByDrinkKeyAndWeek={unitsByDrinkKeyAndWeek}
          drinkTypeFilter={drinkTypeFilter}
          rangeStart={range.start}
          rangeEnd={range.end}
        />
      </ChartCard>

      <TypeConcentrationSentence
        currentUnitsByDrinkKey={currentUnitsByDrinkKey}
        priorUnitsByDrinkKey={priorUnitsByDrinkKey}
        preset={range.preset}
      />
    </ScrollView>
  );
}

BreakdownTab.displayName = 'BreakdownTab';

export default BreakdownTab;
