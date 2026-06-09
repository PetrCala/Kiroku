import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {InteractionManager, StyleSheet, View} from 'react-native';
import {SceneMap, TabView} from 'react-native-tab-view';
import type {
  NavigationState,
  SceneRendererProps,
  TabDescriptor,
} from 'react-native-tab-view';
import {getReceivedRequestsCount} from '@libs/FriendUtils';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import ScreenWrapper from '@components/ScreenWrapper';
import OfflineIndicator from '@components/OfflineIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import TopTabBar, {TOP_TAB_COMMON_OPTIONS} from '@components/TopTabBar';
import type {TopTabRoute} from '@components/TopTabBar';
import useBottomTabBarHeight from '@hooks/useBottomTabBarHeight';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import FriendListScreen from './FriendListScreen';

// Friend List is the default tab, so it stays statically imported and paints on
// mount. Friend Requests is lazily imported — and prefetched once Friend List is
// interactive (see the effect in SocialScreen) — so its module evaluation and
// mount-time effects/fetch stay off the tab-switch frame. This mirrors the
// Statistics screen's treatment of its non-default tabs.
const loadFriendRequestScreen = () => import('./FriendRequestScreen');
const FriendRequestScreen = lazy(loadFriendRequestScreen);

const localStyles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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

// Shown while the lazily imported Friend Requests tab resolves and mounts on its
// first activation; also the TabView placeholder for the not-yet-rendered tab.
function TabLazyPlaceholder(): React.ReactNode {
  return (
    <View style={localStyles.placeholder}>
      <FlexibleLoadingIndicator />
    </View>
  );
}

function renderLazyPlaceholder(): React.ReactNode {
  return <TabLazyPlaceholder />;
}

function FriendRequestScene() {
  return (
    <Suspense fallback={<TabLazyPlaceholder />}>
      <FriendRequestScreen />
    </Suspense>
  );
}

// The Friend List / Friend Requests tabs render at the TOP of the screen via
// `react-native-tab-view`, mirroring the Statistics layout (shared `TopTabBar`).
// Friend List is statically imported (default tab); Friend Requests is lazy +
// Suspense so it stays off the tab-switch frame until first activated.
const renderScene = SceneMap({
  friendList: FriendListScreen,
  friendRequests: FriendRequestScene,
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
  const theme = useTheme();
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {windowWidth} = useWindowDimensions();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [index, setIndex] = useState(0);

  // Warm the lazily imported Friend Requests module in the background once the
  // Friend List tab is interactive, so first tap of the Requests tab renders it
  // without the dynamic-import stall. Errors are swallowed — the real lazy
  // render surfaces them on tap as usual.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      loadFriendRequestScreen().catch(() => undefined);
    });
    return () => {
      handle.cancel?.();
    };
  }, []);

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
        lazy
        renderLazyPlaceholder={renderLazyPlaceholder}
        commonOptions={commonOptions}
        options={sceneOptions}
      />
      <OfflineIndicator style={{marginBottom: bottomTabBarHeight}} />
      {/* Friend-search FAB. Rendered at the ScreenWrapper level (a sibling of
          the TabView/OfflineIndicator), exactly like the Home start-session
          FAB, so it's anchored to the screen and isn't shifted upward by the
          offline indicator's reserved bottom margin the way an in-scene button
          would be. Reuses the Home FAB's container + circle styles so the two
          line up. */}
      <View
        style={[
          styles.floatingActionButtonContainer,
          {bottom: bottomTabBarHeight + 16},
        ]}>
        <PressableWithFeedback
          accessibilityLabel="search-screen-button"
          style={styles.floatingActionButton}
          onPress={() => Navigation.navigate(ROUTES.SOCIAL_FRIEND_SEARCH)}>
          <Icon
            src={KirokuIcons.Search}
            width={28}
            height={28}
            fill={theme.textLight}
          />
        </PressableWithFeedback>
      </View>
    </ScreenWrapper>
  );
}

SocialScreen.displayName = 'SocialScreen';
export default SocialScreen;
