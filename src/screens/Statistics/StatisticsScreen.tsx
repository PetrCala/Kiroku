import React, {useEffect, useState} from 'react';
import type {ComponentType} from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import StatsContextProvider from '@components/StatsContextProvider';
import useLocalize from '@hooks/useLocalize';
import useReadyAfterScreenTransition from '@hooks/useReadyAfterScreenTransition';
import Navigation from '@libs/Navigation/Navigation';
import {markStatsPhase, resetStatsProfile} from '@libs/Statistics/profiling';
import DrillDownProvider from './drilldown/DrillDownContext';
import StatisticsScreenSkeleton from './StatisticsScreenSkeleton';
import StatsDrillDownSheet from './StatsDrillDownSheet';

/**
 * The chart-tab tree (StatisticsTabs → 4 tabs → Skia/Victory imports) plus the
 * `StatsContextProvider` compute are the dominant cost of entering this screen
 * — heavy enough to block the JS thread for 1–3 s on mount, with React
 * Navigation unable to paint a single frame of the slide in the meantime.
 *
 * Gate the whole heavy subtree on the screen's entry-transition end so the
 * slide plays first against a layout-faithful skeleton, then mount the
 * providers and the dynamically imported tabs once the bundle has parsed.
 * `runAfterInteractions` is unsuitable here: its handle resolves before the
 * slide finishes (see `useReadyAfterScreenTransition`).
 *
 * `useDrinkEvents` / `useAggregate` further defer the *data* compute, so the
 * skeleton stays visible until the aggregates are ready.
 */
function StatisticsScreen() {
  const {translate} = useLocalize();
  const {isReady: didScreenTransitionEnd, onEntryTransitionEnd} =
    useReadyAfterScreenTransition();
  const [Tabs, setTabs] = useState<ComponentType | null>(null);

  // Dev-only cold-launch profiler: anchor the timeline at screen mount.
  useEffect(() => {
    resetStatsProfile();
  }, []);

  // Only kick off the chart-bundle import once the slide has finished, so its
  // parse and the subsequent heavy mount never compete with the transition for
  // the JS thread.
  useEffect(() => {
    if (!didScreenTransitionEnd) {
      return undefined;
    }
    markStatsPhase('transition end');
    let cancelled = false;
    import('./StatisticsTabs')
      .then(mod => {
        if (cancelled) {
          return;
        }
        markStatsPhase('chart bundle parsed');
        setTabs(() => mod.default);
      })
      .catch(() => {
        // Dynamic import only fails when the underlying module itself throws —
        // there is no network round-trip in Metro's single-bundle build.
      });
    return () => {
      cancelled = true;
    };
  }, [didScreenTransitionEnd]);

  return (
    <ScreenWrapper
      testID={StatisticsScreen.displayName}
      onEntryTransitionEnd={onEntryTransitionEnd}>
      <HeaderWithBackButton
        title={translate('statistics.title')}
        onBackButtonPress={Navigation.goBack}
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
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';

export default StatisticsScreen;
