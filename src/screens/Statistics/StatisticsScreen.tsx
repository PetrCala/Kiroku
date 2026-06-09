import React, {useEffect, useState} from 'react';
import type {ComponentType} from 'react';
import {InteractionManager} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import OfflineIndicator from '@components/OfflineIndicator';
import ScreenWrapper from '@components/ScreenWrapper';
import StatsContextProvider from '@components/StatsContextProvider';
import useBottomTabBarHeight from '@hooks/useBottomTabBarHeight';
import useLocalize from '@hooks/useLocalize';
import DrillDownProvider from './drilldown/DrillDownContext';
import StatisticsScreenSkeleton from './StatisticsScreenSkeleton';
import StatsDrillDownSheet from './StatsDrillDownSheet';

/**
 * As a bottom tab, this screen has no entry slide to protect, but the chart-tab
 * tree (StatisticsTabs → 4 tabs → Skia/Victory imports) plus the
 * `StatsContextProvider` compute is still heavy enough to block the JS thread
 * for 1–3 s on first mount.
 *
 * Gate the heavy subtree on `InteractionManager.runAfterInteractions` so the
 * layout-faithful skeleton paints first, then mount the providers and the
 * dynamically-imported tabs. The tab is lazily mounted on first visit and then
 * stays mounted (frozen while blurred), so this cost is paid once.
 *
 * `useDrinkEvents` / `useAggregate` further defer the *data* compute, so the
 * skeleton stays visible until the aggregates are ready.
 */
function StatisticsScreen() {
  const {translate} = useLocalize();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [isReady, setIsReady] = useState(false);
  const [Tabs, setTabs] = useState<ComponentType | null>(null);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() =>
      setIsReady(true),
    );
    return () => handle.cancel();
  }, []);

  // Only kick off the chart-bundle import once the screen has settled, so its
  // parse and the subsequent heavy mount never compete with the first paint.
  useEffect(() => {
    if (!isReady) {
      return undefined;
    }
    let cancelled = false;
    import('./StatisticsTabs')
      .then(mod => {
        if (cancelled) {
          return;
        }
        setTabs(() => mod.default);
      })
      .catch(() => {
        // Dynamic import only fails when the underlying module itself throws —
        // there is no network round-trip in Metro's single-bundle build.
      });
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  return (
    <ScreenWrapper
      testID={StatisticsScreen.displayName}
      shouldShowOfflineIndicator={false}>
      <HeaderWithBackButton
        title={translate('statistics.title')}
        shouldShowBackButton={false}
      />
      {Tabs ? (
        <StatsContextProvider>
          <DrillDownProvider>
            <Tabs />
            <StatsDrillDownSheet />
          </DrillDownProvider>
        </StatsContextProvider>
      ) : (
        <StatisticsScreenSkeleton />
      )}
      <OfflineIndicator style={{marginBottom: bottomTabBarHeight + 16}} />
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';

export default StatisticsScreen;
