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
  //
  // [StatsProfile] TEMPORARY diagnostic (diagnostic branch only — remove before
  // any merge). Instead of one `import('./StatisticsTabs')`, cold-import the
  // static graph in pieces and time each. Every import() below is the first
  // evaluation of that subtree, so the deltas are additive and sum to the full
  // cold first-open cost, attributing it to react-native-tab-view vs the
  // OverviewTab component graph vs the StatisticsTabs shell itself. The final
  // import resolves the real default export used to mount the tabs.
  //
  // Emitted via BOTH `console.warn` and `console.error`: babel
  // `transform-remove-console` keeps `warn`/`error` (only `log`/`debug` are
  // stripped), and both reach the device log (`nativeLoggingHook` → os_log /
  // logcat) on a release/adhoc build, where they show in Console.app's default
  // view. (`Log.*` routes through `console.debug`, which is stripped, and
  // Kiroku has no in-app log viewer.) The dev-only Skia-warning override in
  // `suppressSkiaPathDeprecationWarnings` only filters `[react-native-skia]`
  // path-migration messages, so it never touches this line. Filter the device
  // log for `StatsProfile`.
  useEffect(() => {
    if (!isReady) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const t0 = performance.now();
      await import('react-native-tab-view');
      const t1 = performance.now();
      await import('@components/TopTabBar');
      const t2 = performance.now();
      await import('@libs/skiaWeb');
      const t3 = performance.now();
      await import('./tabs/OverviewTab');
      const t4 = performance.now();
      const mod = await import('./StatisticsTabs');
      const t5 = performance.now();
      const line = `[StatsProfile] cold import bisection (ms): tab-view=${(t1 - t0).toFixed(1)} TopTabBar=${(t2 - t1).toFixed(1)} skiaWeb=${(t3 - t2).toFixed(1)} OverviewTab=${(t4 - t3).toFixed(1)} StatisticsTabs-shell=${(t5 - t4).toFixed(1)} | TOTAL=${(t5 - t0).toFixed(1)}`;
      // eslint-disable-next-line no-console
      console.warn(line);
      // eslint-disable-next-line no-console
      console.error(line);
      if (cancelled) {
        return;
      }
      setTabs(() => mod.default);
    })().catch(() => {
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
      includeSafeAreaPaddingBottom={false}
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
      <OfflineIndicator style={{marginBottom: bottomTabBarHeight}} />
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';

export default StatisticsScreen;
