import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {SceneMap, TabView} from 'react-native-tab-view';
import type {
  NavigationState,
  SceneRendererProps,
  TabDescriptor,
} from 'react-native-tab-view';
import {getReceivedRequestsCount} from '@libs/FriendUtils';
import ScreenWrapper from '@components/ScreenWrapper';
import OfflineIndicator from '@components/OfflineIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Text from '@components/Text';
import TopTabBar, {TOP_TAB_COMMON_OPTIONS} from '@components/TopTabBar';
import type {TopTabRoute} from '@components/TopTabBar';
import useBottomTabBarHeight from '@hooks/useBottomTabBarHeight';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useWindowDimensions from '@hooks/useWindowDimensions';
import FriendListScreen from './FriendListScreen';
import FriendRequestScreen from './FriendRequestScreen';

// The Friend List / Friend Requests tabs render at the TOP of the screen via
// `react-native-tab-view`, mirroring the Statistics layout (shared `TopTabBar`).
// Each scene owns its own data via `useCurrentUserData`, so SceneMap can render
// them directly.
const renderScene = SceneMap({
  friendList: FriendListScreen,
  friendRequests: FriendRequestScreen,
});

const localStyles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});

function FriendRequestsBadge({count}: {count: number}) {
  const theme = useTheme();
  return (
    <View style={[localStyles.badge, {backgroundColor: theme.success}]}>
      <Text style={localStyles.badgeText}>{count}</Text>
    </View>
  );
}

function SocialScreen() {
  const userData = useCurrentUserData();
  const {translate} = useLocalize();
  const {windowWidth} = useWindowDimensions();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [index, setIndex] = useState(0);

  const routes = useMemo<TopTabRoute[]>(
    () => [
      {key: 'friendList', title: translate('socialScreen.friendList')},
      {key: 'friendRequests', title: translate('socialScreen.friendRequests')},
    ],
    [translate],
  );

  const requestCount = getReceivedRequestsCount(userData?.friend_requests);

  const renderRequestsBadge = useCallback(
    () => <FriendRequestsBadge count={requestCount} />,
    [requestCount],
  );

  // Show the pending-request count as a tab badge (preserves the signal the old
  // bottom footer carried).
  const sceneOptions = useMemo<
    Record<string, TabDescriptor<TopTabRoute>> | undefined
  >(
    () =>
      requestCount > 0
        ? {friendRequests: {badge: renderRequestsBadge}}
        : undefined,
    [requestCount, renderRequestsBadge],
  );

  const renderTabBar = useCallback(
    (
      tabBarProps: SceneRendererProps & {
        navigationState: NavigationState<TopTabRoute>;
        options: Record<string, TabDescriptor<TopTabRoute>> | undefined;
      },
    ) => <TopTabBar tabBarProps={tabBarProps} />,
    [],
  );

  // Inset every scene above the native bottom tab bar (which overlays the
  // scene) on top of the shared label options.
  const commonOptions = useMemo<TabDescriptor<TopTabRoute>>(
    () => ({
      ...TOP_TAB_COMMON_OPTIONS,
      sceneStyle: {paddingBottom: bottomTabBarHeight},
    }),
    [bottomTabBarHeight],
  );

  return (
    <ScreenWrapper
      testID={SocialScreen.displayName}
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicator={false}>
      <HeaderWithBackButton
        title={translate('socialScreen.title')}
        shouldShowBackButton={false}
      />
      <TabView
        navigationState={{index, routes}}
        onIndexChange={setIndex}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        initialLayout={{width: windowWidth}}
        commonOptions={commonOptions}
        options={sceneOptions}
      />
      <OfflineIndicator style={{marginBottom: bottomTabBarHeight}} />
    </ScreenWrapper>
  );
}

SocialScreen.displayName = 'SocialScreen';
export default SocialScreen;
