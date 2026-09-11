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
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {StackScreenProps} from '@react-navigation/stack';
import type {BottomTabNavigatorParamList} from '@libs/Navigation/types';
import ScreenWrapper from '@components/ScreenWrapper';
import OfflineIndicator from '@components/OfflineIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import CountBadge from '@components/CountBadge';
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
// mount. Friend Requests is lazily imported (and prefetched once Friend List is
// interactive, see the effect in SocialScreen), so its module evaluation and
// mount-time effects/fetch stay off the tab-switch frame. This mirrors the
// Statistics screen's treatment of its non-default tabs.
const loadFriendRequestScreen = () => import('./FriendRequestScreen');
const FriendRequestScreen = lazy(loadFriendRequestScreen);

/** Extends the 36px pill's touch target to 44pt vertically. */
const ADD_FRIENDS_HIT_SLOP = {top: 4, bottom: 4, left: 4, right: 4};

const localStyles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Same brand pill as DayOverviewScreen's edit toggle, widened for a label.
  addFriendsPill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

function renderTabBar(
  tabBarProps: SceneRendererProps & {
    navigationState: NavigationState<TopTabRoute>;
    options: Record<string, TabDescriptor<TopTabRoute>> | undefined;
  },
) {
  return <TopTabBar tabBarProps={tabBarProps} />;
}

/**
 * The one entry point for adding friends: a labeled brand pill in the header,
 * so it's on both tabs and reads as a button. It opens the Add friends hub on
 * the "Your code" tab; search is the hub's second tab.
 */
function AddFriendsButton() {
  const theme = useTheme();
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  return (
    <PressableWithFeedback
      accessibilityLabel={translate('socialScreen.addFriends')}
      accessibilityRole={CONST.ROLE.BUTTON}
      onPress={() => Navigation.navigate(ROUTES.SOCIAL_ADD_FRIENDS.getRoute())}
      hitSlop={ADD_FRIENDS_HIT_SLOP}
      style={[localStyles.addFriendsPill, {backgroundColor: theme.appColor}]}>
      <Icon
        src={KirokuIcons.AddUser}
        width={variables.iconSizeSmall}
        height={variables.iconSizeSmall}
        fill={theme.textOnBrand}
      />
      <Text
        style={[
          styles.textNormal,
          styles.textStrong,
          {color: theme.textOnBrand},
        ]}>
        {translate('socialScreen.addFriends')}
      </Text>
    </PressableWithFeedback>
  );
}

type SocialScreenProps = StackScreenProps<
  BottomTabNavigatorParamList,
  typeof SCREENS.SOCIAL.ROOT
>;

function SocialScreen({route, navigation}: SocialScreenProps) {
  const userData = useCurrentUserData();
  const {translate} = useLocalize();
  const {windowWidth} = useWindowDimensions();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [index, setIndex] = useState(0);

  // Warm the lazily imported Friend Requests module in the background once the
  // Friend List tab is interactive, so first tap of the Requests tab renders it
  // without the dynamic-import stall. Errors are swallowed; the real lazy
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

  // A `tab` param (e.g. from a tapped friend-request notification) selects that
  // tab while it's set. The user's own tab switch clears it, so it never fights
  // manual navigation and a later notification can select the tab again.
  const requestedTab = route.params?.tab;
  const requestedIndex = requestedTab
    ? routes.findIndex(tabRoute => tabRoute.key === requestedTab)
    : -1;
  const activeIndex = requestedIndex >= 0 ? requestedIndex : index;

  const onIndexChange = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      if (requestedTab) {
        navigation.setParams({tab: undefined});
      }
    },
    [navigation, requestedTab],
  );

  const requestCount = getReceivedRequestsCount(userData?.friend_requests);

  const renderRequestsBadge = useCallback(
    () => <CountBadge count={requestCount} />,
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
        // The title moves to the start so the labeled pill has room on the
        // right. The pill sits above the tabs, so it's on both of them.
        shouldAlignTitleStart
        customRightButton={<AddFriendsButton />}
      />
      <TabView
        navigationState={{index: activeIndex, routes}}
        onIndexChange={onIndexChange}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        initialLayout={{width: windowWidth}}
        lazy
        renderLazyPlaceholder={renderLazyPlaceholder}
        commonOptions={commonOptions}
        options={sceneOptions}
      />
      <OfflineIndicator style={{marginBottom: bottomTabBarHeight}} />
    </ScreenWrapper>
  );
}

SocialScreen.displayName = 'SocialScreen';
export default SocialScreen;
