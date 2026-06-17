import React, {useEffect, useState} from 'react';
import type {ComponentType} from 'react';
import {InteractionManager} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import OfflineIndicator from '@components/OfflineIndicator';
import ScreenWrapper from '@components/ScreenWrapper';
import useBottomTabBarHeight from '@hooks/useBottomTabBarHeight';
import useLocalize from '@hooks/useLocalize';
import StatisticsScreenSkeleton from './StatisticsScreenSkeleton';

/**
 * As a bottom tab, this screen has no entry slide to protect, but the content
 * subtree (`StatisticsContent` → stats providers + chart tabs → Skia/Victory
 * imports + drill-down sheet) plus the `StatsContextProvider` compute is heavy
 * enough to block the JS thread for 1–3 s on first mount.
 *
 * Keep the screen's *static* import graph to just the header + skeleton, and
 * defer the whole content subtree behind a dynamic import gated on
 * `InteractionManager.runAfterInteractions`. That way the first commit (the
 * layout-faithful skeleton) lands as early as possible — minimizing the blank
 * native-tab window — and the providers, tabs, and sheet are mounted only once
 * the screen has settled. The tab is lazily mounted on first visit and then
 * stays mounted (frozen while blurred), so this cost is paid once.
 *
 * `useDrinkEvents` / `useAggregate` further defer the *data* compute, so the
 * skeleton stays visible until the aggregates are ready.
 */
function StatisticsScreen() {
  const {translate} = useLocalize();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [isReady, setIsReady] = useState(false);
  const [Content, setContent] = useState<ComponentType | null>(null);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() =>
      setIsReady(true),
    );
    return () => handle.cancel();
  }, []);

  // Only kick off the content-bundle import once the screen has settled, so its
  // parse and the subsequent heavy mount never compete with the first paint.
  useEffect(() => {
    if (!isReady) {
      return undefined;
    }
    let cancelled = false;
    import('./StatisticsContent')
      .then(mod => {
        if (cancelled) {
          return;
        }
        setContent(() => mod.default);
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
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicator={false}>
      <HeaderWithBackButton
        title={translate('statistics.title')}
        shouldShowBackButton={false}
      />
      {Content ? <Content /> : <StatisticsScreenSkeleton />}
      <OfflineIndicator style={{marginBottom: bottomTabBarHeight}} />
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';

export default StatisticsScreen;
