import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import StatsContextProvider from '@components/StatsContextProvider';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import DrillDownProvider from './drilldown/DrillDownContext';
import StatsDrillDownSheet from './StatsDrillDownSheet';
import StatisticsTabs from './StatisticsTabs';

function StatisticsScreen() {
  const {translate} = useLocalize();

  return (
    <ScreenWrapper testID={StatisticsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('statistics.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <StatsContextProvider>
        <DrillDownProvider>
          {/* The filter toolbar lives per-tab (Trends/Patterns/Breakdown);
              Overview uses fixed this-month/this-week semantics. */}
          <StatisticsTabs />
          <StatsDrillDownSheet />
        </DrillDownProvider>
      </StatsContextProvider>
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';

export default StatisticsScreen;
