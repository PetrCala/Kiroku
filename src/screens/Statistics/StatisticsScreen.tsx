import React, {useMemo} from 'react';
import {View} from 'react-native';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import ScrollView from '@components/ScrollView';
import {
  BarsWeekly,
  HeatmapCalendar,
  KpiTile,
  LineTrend,
  StackedBarsByType,
} from '@components/Charts';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import {buildDayRollupsFromSessions} from '@libs/Analytics/rollups';
import {getKpis} from '@libs/Analytics/selectors/kpis';
import {getWeeklyBars} from '@libs/Analytics/selectors/weeklyBars';
import {getRollingTrend} from '@libs/Analytics/selectors/rollingTrend';
import {getByTypeStackedWeekly} from '@libs/Analytics/selectors/composition';
import {getHeatmapDays} from '@libs/Analytics/selectors/heatmap';

function StatisticsScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const {drinkingSessionData, preferences} = useDatabaseData();

  const dayRows = useMemo(() => {
    if (!user || !drinkingSessionData || !preferences) {
      return [];
    }

    // Get drinks to units mapping from preferences
    const drinksToUnits = preferences.drinks_to_units ?? {};

    return buildDayRollupsFromSessions(
      drinkingSessionData,
      drinksToUnits,
      user.uid,
    );
  }, [drinkingSessionData, preferences, user]);

  const kpi = useMemo(() => getKpis(dayRows), [dayRows]);
  const weekly = useMemo(() => getWeeklyBars(dayRows), [dayRows]);
  const trend = useMemo(() => getRollingTrend(dayRows, 28), [dayRows]);
  const stacked = useMemo(() => getByTypeStackedWeekly(dayRows, 8), [dayRows]);
  const heat = useMemo(() => getHeatmapDays(dayRows, 90), [dayRows]);

  return (
    <ScreenWrapper testID={StatisticsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('statisticsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView style={[styles.flex1]}>
        <View style={{flexDirection: 'row', gap: 12}}>
          <KpiTile label="Today" value={kpi.todaySdu} unit="SDU" />
          <KpiTile
            label="This Week"
            value={kpi.weekSdu}
            unit="SDU"
            deltaPct={kpi.weekVsPrevPct}
          />
          <KpiTile label="Drinks" value={kpi.drinksToday} />
        </View>

        <BarsWeekly
          data={weekly}
          formatX={x => x}
          formatY={y => y.toFixed(1)}
          targetLine={undefined}
        />

        <LineTrend data={trend} />

        <StackedBarsByType data={stacked} />

        <HeatmapCalendar days={heat} scale="count" />
      </ScrollView>
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';
export default StatisticsScreen;
