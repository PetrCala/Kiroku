import type {TupleToUnion} from 'type-fest';
import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {InteractionManager, StyleSheet, View} from 'react-native';
import {SceneMap, TabBar, TabView} from 'react-native-tab-view';
import type {
  NavigationState,
  SceneRendererProps,
  TabDescriptor,
} from 'react-native-tab-view';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import {StatsFilterToolbarSkeleton} from '@components/Statistics/StatsFilterToolbar';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useWindowDimensions from '@hooks/useWindowDimensions';
import type {TranslationPaths} from '@src/languages/types';
import OverviewTab from './tabs/OverviewTab';

// Overview is the default tab, so it stays statically imported and paints on
// mount. The other three each pull a distinct slice of the Skia/victory chart
// stack; loading them lazily keeps their modules out of the screen's first
// dynamic-import parse (the ~2 s "chart bundle parsed" gate) and defers each
// to the moment its tab is first activated, behind the same placeholder the
// TabView already shows for not-yet-rendered tabs.
//
// The loaders are named so we can also prefetch them in the background once
// Overview is interactive (see the effect below). Profiling showed first-tap
// of a non-Overview tab is dominated by this multi-second dynamic import, while
// the tab's own aggregation is sub-millisecond — so warming the modules ahead
// of the tap removes essentially the whole stall.
const loadTrendsTab = () => import('./tabs/TrendsTab');
const loadPatternsTab = () => import('./tabs/PatternsTab');
const loadBreakdownTab = () => import('./tabs/BreakdownTab');

const TrendsTab = lazy(loadTrendsTab);
const PatternsTab = lazy(loadPatternsTab);
const BreakdownTab = lazy(loadBreakdownTab);

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

function TrendsScene() {
  return (
    <Suspense fallback={<TabLazyPlaceholder />}>
      <TrendsTab />
    </Suspense>
  );
}

function PatternsScene() {
  return (
    <Suspense fallback={<TabLazyPlaceholder />}>
      <PatternsTab />
    </Suspense>
  );
}

function BreakdownScene() {
  return (
    <Suspense fallback={<TabLazyPlaceholder />}>
      <BreakdownTab />
    </Suspense>
  );
}

const renderScene = SceneMap({
  overview: OverviewTab,
  trends: TrendsScene,
  patterns: PatternsScene,
  breakdown: BreakdownScene,
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
  },
  lazyPlaceholderBody: {
    paddingHorizontal: 12,
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

// First mount of an inactive tab: paint a generic tab-shell skeleton so the
// user sees structure for the 200–400ms it takes the tab's actual render +
// deferred compute to land. Every lazy tab (Trends/Patterns/Breakdown) leads
// with the filter toolbar followed by chart cards, so mirror that shape.
// Per-chart skeletons take over once the tab mounts; this is the bridge between
// "tap" and "mount" — used both as the TabView placeholder and as the Suspense
// fallback while the tab's lazily-imported chart module is parsing.
function TabLazyPlaceholder(): React.ReactNode {
  return (
    <View style={styles.lazyPlaceholder}>
      <StatsFilterToolbarSkeleton />
      <View style={styles.lazyPlaceholderBody}>
        <ChartSkeleton variant="card" />
        <View style={styles.lazyPlaceholderGap} />
        <ChartSkeleton variant="card" />
      </View>
    </View>
  );
}

function renderLazyPlaceholder(): React.ReactNode {
  return <TabLazyPlaceholder />;
}

const COMMON_OPTIONS: TabDescriptor<TabRoute> = {
  label: renderTabLabel,
};

function StatisticsTabs() {
  const {translate} = useLocalize();
  const theme = useTheme();
  const {windowWidth} = useWindowDimensions();
  const [index, setIndex] = useState(0);

  // Warm the lazy tab chart bundles in the background once Overview has
  // painted and the navigation transition has settled. Sequential so the three
  // heavy module evaluations don't compete for the JS thread while the user is
  // reading Overview; by the time a tab is tapped its module is already
  // resolved, so React renders it without the first-import stall. Errors are
  // swallowed — the real lazy render surfaces them on tap as usual.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      loadTrendsTab()
        .then(loadPatternsTab)
        .then(loadBreakdownTab)
        .catch(() => undefined);
    });
    return () => {
      handle.cancel?.();
    };
  }, []);

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
