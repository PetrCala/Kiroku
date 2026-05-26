import type {TupleToUnion} from 'type-fest';
import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {SceneMap, TabBar, TabView} from 'react-native-tab-view';
import type {
  NavigationState,
  SceneRendererProps,
  TabDescriptor,
} from 'react-native-tab-view';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useWindowDimensions from '@hooks/useWindowDimensions';
import type {TranslationPaths} from '@src/languages/types';
import BreakdownTab from './tabs/BreakdownTab';
import OverviewTab from './tabs/OverviewTab';
import PatternsTab from './tabs/PatternsTab';
import TrendsTab from './tabs/TrendsTab';

// Tab order is locked per STATISTICS_V2.md and issue #582.
const ROUTE_KEYS = ['overview', 'trends', 'patterns', 'breakdown'] as const;
type RouteKey = TupleToUnion<typeof ROUTE_KEYS>;

type TabRoute = {
  key: RouteKey;
  title: string;
};

const LABEL_KEYS: Record<RouteKey, TranslationPaths> = {
  overview: 'statistics.tabs.overview.label',
  trends: 'statistics.tabs.trends.label',
  patterns: 'statistics.tabs.patterns.label',
  breakdown: 'statistics.tabs.breakdown.label',
};

const renderScene = SceneMap({
  overview: OverviewTab,
  trends: TrendsTab,
  patterns: PatternsTab,
  breakdown: BreakdownTab,
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBarIndicator: {
    height: 2,
  },
  tabBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  lazyPlaceholder: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  lazyPlaceholderGap: {
    height: 16,
  },
});

function renderTabLabel({
  route,
  color,
}: {
  route: TabRoute;
  color: string;
}): React.ReactNode {
  return <Text style={[styles.tabBarLabel, {color}]}>{route.title}</Text>;
}

function renderLazyPlaceholder(): React.ReactNode {
  // First mount of an inactive tab: paint a generic tab-shell skeleton so the
  // user sees structure for the 200–400ms it takes the tab's actual render +
  // deferred compute to land. Per-chart skeletons take over once the tab
  // mounts; this is just the bridge between "tap" and "mount".
  return (
    <View style={styles.lazyPlaceholder}>
      <ChartSkeleton variant="kpiRow" />
      <View style={styles.lazyPlaceholderGap} />
      <ChartSkeleton variant="card" />
    </View>
  );
}

const COMMON_OPTIONS: TabDescriptor<TabRoute> = {
  label: renderTabLabel,
};

function StatisticsTabs() {
  const {translate} = useLocalize();
  const theme = useTheme();
  const {windowWidth} = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const routes = useMemo<TabRoute[]>(
    () =>
      ROUTE_KEYS.map(key => ({
        key,
        title: translate(LABEL_KEYS[key]),
      })),
    [translate],
  );

  const renderTabBar = useCallback(
    (
      tabBarProps: SceneRendererProps & {
        navigationState: NavigationState<TabRoute>;
        options: Record<string, TabDescriptor<TabRoute>> | undefined;
      },
    ) => (
      <TabBar
        layout={tabBarProps.layout}
        position={tabBarProps.position}
        jumpTo={tabBarProps.jumpTo}
        navigationState={tabBarProps.navigationState}
        options={tabBarProps.options}
        scrollEnabled={false}
        style={[
          styles.tabBar,
          {backgroundColor: theme.appBG, borderBottomColor: theme.border},
        ]}
        indicatorStyle={[
          styles.tabBarIndicator,
          {backgroundColor: theme.success},
        ]}
        activeColor={theme.text}
        inactiveColor={theme.textSupporting}
        pressColor={theme.hoverComponentBG}
      />
    ),
    [
      theme.appBG,
      theme.border,
      theme.hoverComponentBG,
      theme.success,
      theme.text,
      theme.textSupporting,
    ],
  );

  return (
    <TabView
      style={[styles.container, {backgroundColor: theme.appBG}]}
      navigationState={{index, routes}}
      onIndexChange={setIndex}
      renderScene={renderScene}
      renderTabBar={renderTabBar}
      initialLayout={{width: windowWidth}}
      lazy
      renderLazyPlaceholder={renderLazyPlaceholder}
      commonOptions={COMMON_OPTIONS}
    />
  );
}

StatisticsTabs.displayName = 'StatisticsTabs';

export default StatisticsTabs;
