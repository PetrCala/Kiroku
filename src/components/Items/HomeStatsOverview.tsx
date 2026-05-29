import {View} from 'react-native';
import type {DateData} from 'react-native-calendars';
import {DrinkBreakdown} from '@components/Charts/DrinkBreakdown';
import {KpiCard, KpiCardGroup} from '@components/Charts/KpiCard';
import type {KpiCardProps} from '@components/Charts/KpiCard';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useHomeStats from '@hooks/useHomeStats';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import ROUTES from '@src/ROUTES';

type DeltaShape = NonNullable<KpiCardProps['delta']>;

function formatUnits(value: number): string {
  // 1 decimal for partial units, else integer — matches the Statistics tabs.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

type HomeStatsOverviewProps = {
  visibleDate: DateData;
};

/**
 * Home-screen stats block: a "Units" hero (with a per-drink-type breakdown
 * and a quiet shortcut to the Statistics screen) over a supporting pair of
 * sessions and alcohol-free days. Every tile carries a "vs last month" delta.
 */
function HomeStatsOverview({visibleDate}: HomeStatsOverviewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {isLoading, current, previous, drinkBreakdown} =
    useHomeStats(visibleDate);

  const vsLastMonth = translate('homeScreen.stats.vsLastMonth');
  const makeDelta = (cur: number, prev: number): DeltaShape => {
    const diff = Number((cur - prev).toFixed(1));
    let direction: DeltaShape['direction'] = 'flat';
    if (diff > 0) {
      direction = 'up';
    } else if (diff < 0) {
      direction = 'down';
    }
    return {value: diff, direction, label: vsLastMonth};
  };

  const statisticsLink = (
    <PressableWithFeedback
      accessibilityLabel={translate('homeScreen.stats.viewStatistics')}
      accessibilityRole="button"
      onPress={() => Navigation.navigate(ROUTES.STATISTICS)}
      style={[styles.flexRow, styles.alignItemsCenter]}>
      <Text style={[styles.textMicroSupporting, styles.mr1]}>
        {translate('homeScreen.stats.statistics')}
      </Text>
      <Icon
        src={KirokuIcons.ArrowRight}
        width={12}
        height={12}
        fill={theme.icon}
      />
    </PressableWithFeedback>
  );

  const supportingCards: KpiCardProps[] = [
    {
      label: translate('homeScreen.stats.sessions'),
      value: current.sessions,
      delta: makeDelta(current.sessions, previous.sessions),
      polarity: 'lower-is-supportive',
    },
    {
      label: translate('homeScreen.stats.alcoholFree'),
      value: current.afDays,
      unit: `/${current.elapsedDays}`,
      delta: makeDelta(current.afDays, previous.afDays),
      tone: 'celebratory',
      polarity: 'higher-is-supportive',
    },
  ];

  return (
    <View style={styles.mt2}>
      <View style={styles.mb2}>
        <KpiCard
          label={translate('homeScreen.stats.units')}
          value={formatUnits(current.totalUnits)}
          delta={makeDelta(current.totalUnits, previous.totalUnits)}
          polarity="lower-is-supportive"
          headerRight={statisticsLink}
          chart={
            <DrinkBreakdown
              items={drinkBreakdown}
              accessibilityLabel={translate(
                'homeScreen.stats.drinkBreakdownA11y',
              )}
              isLoading={isLoading}
            />
          }
          isLoading={isLoading}
        />
      </View>
      <KpiCardGroup cards={supportingCards} isLoading={isLoading} />
    </View>
  );
}

HomeStatsOverview.displayName = 'HomeStatsOverview';

export default HomeStatsOverview;
export type {HomeStatsOverviewProps};
