import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {Animated, InteractionManager, StyleSheet, View} from 'react-native';
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
import FloatingActionSurface from '@components/FloatingActionSurface';
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

type PagerPositionCaptureProps = {
  /* The pager's continuous swipe-progress value (tab index space) */
  position: Animated.AnimatedInterpolation<number>;

  /* Called with the position value on mount and whenever its identity changes */
  onPositionChange: (position: Animated.AnimatedInterpolation<number>) => void;
};

/**
 * Surfaces the TabView pager's `position` animated value (only exposed via
 * `renderTabBar` props) to the parent screen. Effect-based on purpose: the web
 * pager (PanResponderAdapter) recreates `position` on layout changes, so a
 * capture-once ref would go stale, and capturing during render would set
 * parent state mid-render.
 */
function PagerPositionCapture({
  position,
  onPositionChange,
}: PagerPositionCaptureProps) {
  useEffect(() => {
    onPositionChange(position);
  }, [position, onPositionChange]);
  return null;
}

function SocialScreen() {
  const userData = useCurrentUserData();
  const theme = useTheme();
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {windowWidth} = useWindowDimensions();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [index, setIndex] = useState(0);
  const [pagerPosition, setPagerPosition] =
    useState<Animated.AnimatedInterpolation<number> | null>(null);

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
    ) => (
      <>
        <PagerPositionCapture
          position={tabBarProps.position}
          onPositionChange={setPagerPosition}
        />
        <TopTabBar tabBarProps={tabBarProps} />
      </>
    ),
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

  // The friend-search FAB belongs to the Friend Requests tab only. Its opacity
  // tracks the pager's continuous swipe progress (0 = Friend List, 1 = Friend
  // Requests) instead of the settled index, so it starts dimming the instant a
  // swipe back toward Friend List begins and starts appearing during the swipe
  // (or tab-tap slide) toward Friend Requests — not only after the transition
  // settles. The static fallback only covers the first render, before the tab
  // bar has surfaced the position value (initial tab is Friend List → hidden).
  const isFriendRequestsTab = routes[index]?.key === 'friendRequests';
  const fabOpacity = useMemo(
    () =>
      pagerPosition?.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }) ?? (isFriendRequestsTab ? 1 : 0),
    [pagerPosition, isFriendRequestsTab],
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
      {/* Friend-search FAB, only on the Friend Requests tab. Rendered at the
          ScreenWrapper level (a sibling of the TabView/OfflineIndicator),
          exactly like the Home start-session FAB, so it's anchored to the
          screen and isn't shifted upward by the offline indicator's reserved
          bottom margin the way an in-scene button would be. Kept mounted with
          its opacity bound to the pager's swipe progress (see `fabOpacity`);
          `pointerEvents` stays gated on the settled index so a half-faded
          button can't be tapped mid-swipe or from the Friend List tab. */}
      <Animated.View
        pointerEvents={isFriendRequestsTab ? 'auto' : 'none'}
        style={[
          styles.floatingActionButtonContainer,
          {bottom: bottomTabBarHeight + 16},
          {opacity: fabOpacity},
        ]}>
        <PressableWithFeedback
          accessibilityLabel="search-screen-button"
          onPress={() => Navigation.navigate(ROUTES.SOCIAL_FRIEND_SEARCH)}>
          <FloatingActionSurface>
            <Icon
              src={KirokuIcons.Search}
              width={28}
              height={28}
              fill={theme.textLight}
            />
          </FloatingActionSurface>
        </PressableWithFeedback>
      </Animated.View>
    </ScreenWrapper>
  );
}

SocialScreen.displayName = 'SocialScreen';
export default SocialScreen;
