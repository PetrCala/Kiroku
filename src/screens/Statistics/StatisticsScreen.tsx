import React, {useEffect, useState} from 'react';
import type {ComponentType} from 'react';
import {InteractionManager} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import StatsContextProvider from '@components/StatsContextProvider';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import DrillDownProvider from './drilldown/DrillDownContext';
import StatisticsScreenSkeleton from './StatisticsScreenSkeleton';
import StatsDrillDownSheet from './StatsDrillDownSheet';

/**
 * The chart-tab tree (StatisticsTabs → 4 tabs → Skia/Victory imports) is the
 * dominant cost of entering this screen — heavy enough that a static
 * top-level import would block the JS thread on tap for 1–3 s while the
 * chart libraries evaluate, with React Navigation unable to paint a single
 * frame in the meantime. Deferring the import past the navigation
 * transition with `InteractionManager.runAfterInteractions` lets the
 * screen mount immediately with a layout-faithful skeleton, then swap in
 * the real tabs after the chart bundle has parsed.
 *
 * `useDrinkEvents` / `useAggregate` further defer the *data* compute past
 * the same interaction frame, so the skeletons stay visible until the
 * aggregates are ready.
 */
function StatisticsScreen() {
  const {translate} = useLocalize();
  const [Tabs, setTabs] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }
      import('./StatisticsTabs')
        .then(mod => {
          if (cancelled) {
            return;
          }
          setTabs(() => mod.default);
        })
        .catch(() => {
          // Dynamic import only fails when the underlying module itself
          // throws — there is no network round-trip in Metro's single-bundle
          // build. Surface the failure to the dev console so it is visible
          // in QA; the screen stays on its skeleton state.
        });
    });
    return () => {
      cancelled = true;
      handle.cancel?.();
    };
  }, []);

  return (
    <ScreenWrapper testID={StatisticsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('statistics.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <StatsContextProvider>
        <DrillDownProvider>
          {Tabs ? (
            <>
              <Tabs />
              <StatsDrillDownSheet />
            </>
          ) : (
            <StatisticsScreenSkeleton />
          )}
        </DrillDownProvider>
      </StatsContextProvider>
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';

export default StatisticsScreen;
