import {View} from 'react-native';
import type {DateData} from 'react-native-calendars';
import {PeriodBarList} from '@components/Charts/PeriodBarList';
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
 * Home-screen stats block: a "Units" hero (with a per-week bar chart and a
 * quiet shortcut to the Statistics screen) over a supporting pair of
 * sessions and alcohol-free days. Every tile carries a "vs last month" delta.
 */
function HomeStatsOverview({visibleDate}: HomeStatsOverviewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {isLoading, current, previous, subPeriods, liveExtraUnits} =
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

  // Overlay the live session's units on the cached month total; PeriodBarList
  // adds the same overlay to the latest week's bar so the two agree.
  const totalUnits = current.totalUnits + liveExtraUnits;

  return (
    <View style={styles.mt2}>
      <View style={styles.mb2}>
        <KpiCard
          label={translate('homeScreen.stats.units')}
          value={formatUnits(totalUnits)}
          delta={makeDelta(totalUnits, previous.totalUnits)}
          polarity="lower-is-supportive"
          headerRight={statisticsLink}
          chart={
            <View>
              <Text style={[styles.textMicroSupporting, styles.mb1]}>
                {translate('homeScreen.stats.unitsByWeek')}
              </Text>
              <PeriodBarList
                points={subPeriods}
                granularity="week"
                liveExtraUnits={liveExtraUnits}
                accessibilityLabel={translate(
                  'homeScreen.stats.unitsPerWeekA11y',
                )}
                isLoading={isLoading}
              />
            </View>
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
