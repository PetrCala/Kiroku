import React from 'react';
import {StyleSheet} from 'react-native';
import {TabBar} from 'react-native-tab-view';
import type {
  NavigationState,
  SceneRendererProps,
  TabDescriptor,
} from 'react-native-tab-view';
import useTheme from '@hooks/useTheme';
import Text from './Text';

/** Minimal route shape shared by every top-tab screen. */
type TopTabRoute = {
  key: string;
  title: string;
};

type TopTabBarRenderProps<T extends TopTabRoute = TopTabRoute> =
  SceneRendererProps & {
    navigationState: NavigationState<T>;
    options: Record<string, TabDescriptor<T>> | undefined;
  };

type TopTabBarProps<T extends TopTabRoute = TopTabRoute> = {
  /** The props `react-native-tab-view` passes to `renderTabBar`. */
  tabBarProps: TopTabBarRenderProps<T>;
};

const styles = StyleSheet.create({
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
});

function renderTopTabLabel({
  route,
  color,
}: {
  route: TopTabRoute;
  color: string;
}): React.ReactNode {
  return <Text style={[styles.tabBarLabel, {color}]}>{route.title}</Text>;
}

/** Shared `commonOptions` for a top-tab `TabView` — themes the labels. */
const TOP_TAB_COMMON_OPTIONS: TabDescriptor<TopTabRoute> = {
  label: renderTopTabLabel,
};

/**
 * The themed top tab bar shared by the Statistics and Social screens so their
 * inner tabs look identical. Pass it to a `react-native-tab-view` `TabView` via
 * `renderTabBar={tabBarProps => <TopTabBar tabBarProps={tabBarProps} />}` and
 * pass `TOP_TAB_COMMON_OPTIONS` to the `TabView`'s `commonOptions`.
 */
function TopTabBar<T extends TopTabRoute>({tabBarProps}: TopTabBarProps<T>) {
  const theme = useTheme();
  return (
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
  );
}

TopTabBar.displayName = 'TopTabBar';

export default TopTabBar;
export {TOP_TAB_COMMON_OPTIONS};
export type {TopTabRoute, TopTabBarRenderProps};
