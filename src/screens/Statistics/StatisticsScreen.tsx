import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import StatsContextProvider from '@components/StatsContextProvider';
import StatsFilterToolbar from '@components/Statistics/StatsFilterToolbar';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
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
        <StatsFilterToolbar />
        <StatisticsTabs />
      </StatsContextProvider>
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';

export default StatisticsScreen;
