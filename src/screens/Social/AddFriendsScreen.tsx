import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useMemo, useState} from 'react';
import {TabView} from 'react-native-tab-view';
import type {
  NavigationState,
  SceneRendererProps,
  TabDescriptor,
} from 'react-native-tab-view';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import ScreenWrapper from '@components/ScreenWrapper';
import TopTabBar, {TOP_TAB_COMMON_OPTIONS} from '@components/TopTabBar';
import type {TopTabRoute} from '@components/TopTabBar';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useSafeAreaInsets from '@hooks/useSafeAreaInsets';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import Navigation from '@libs/Navigation/Navigation';
import type {SocialNavigatorParamList} from '@libs/Navigation/types';
import variables from '@styles/variables';
import * as FriendInvite from '@userActions/FriendInvite';
import CONST from '@src/CONST';
import type SCREENS from '@src/SCREENS';
import FriendSearchView from './AddFriends/FriendSearchView';
import InviteCodeView from './AddFriends/InviteCodeView';

type AddFriendsScreenProps = StackScreenProps<
  SocialNavigatorParamList,
  typeof SCREENS.SOCIAL.ADD_FRIENDS
>;

/** Gap between the popover menu's right edge and the window edge. */
const MENU_EDGE_INSET = 20;

function renderTabBar(
  tabBarProps: SceneRendererProps & {
    navigationState: NavigationState<TopTabRoute>;
    options: Record<string, TabDescriptor<TopTabRoute>> | undefined;
  },
) {
  return <TopTabBar tabBarProps={tabBarProps} />;
}

/**
 * The Add friends hub, opened from the Friends header. Two tabs: "Your code"
 * (the personal invite QR code and link) and "Search" (find someone by name).
 * The header's three-dots menu holds the code's one rare action, resetting the
 * invite link, so it only shows on the "Your code" tab.
 */
function AddFriendsScreen({route}: AddFriendsScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {windowWidth} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {isOffline} = useNetwork();
  const userData = useCurrentUserData();
  const hasInviteLink = !!userData?.invite_code;

  const [index, setIndex] = useState(
    route.params?.tab === CONST.ADD_FRIENDS_TAB.SEARCH ? 1 : 0,
  );
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasResetFailed, setHasResetFailed] = useState(false);

  const routes = useMemo<TopTabRoute[]>(
    () => [
      {
        key: CONST.ADD_FRIENDS_TAB.CODE,
        title: translate('addFriendsScreen.yourCode'),
      },
      {
        key: CONST.ADD_FRIENDS_TAB.SEARCH,
        title: translate('addFriendsScreen.search'),
      },
    ],
    [translate],
  );
  const isCodeTab = routes[index]?.key === CONST.ADD_FRIENDS_TAB.CODE;

  const resetLink = useCallback(() => {
    setIsResetModalVisible(false);
    setIsResetting(true);
    setHasResetFailed(false);
    FriendInvite.resetInviteCode()
      .catch(() => setHasResetFailed(true))
      .finally(() => setIsResetting(false));
  }, []);

  const showInviteCode = useCallback(() => setIndex(0), []);

  const renderScene = useCallback(
    ({route: sceneRoute}: SceneRendererProps & {route: TopTabRoute}) =>
      sceneRoute.key === CONST.ADD_FRIENDS_TAB.CODE ? (
        <InviteCodeView
          isResetting={isResetting}
          hasResetFailed={hasResetFailed}
        />
      ) : (
        <FriendSearchView onShowInviteCode={showInviteCode} />
      ),
    [isResetting, hasResetFailed, showInviteCode],
  );

  // On wide layouts the popover opens with its top-left corner at this point:
  // line its right edge up with the header's right padding, just below the
  // header. Narrow layouts show the menu docked instead.
  const {width: menuWidth} = styles.createMenuContainer;
  const threeDotsAnchorPosition = useMemo(
    () => ({
      horizontal:
        windowWidth -
        (typeof menuWidth === 'number' ? menuWidth : 0) -
        MENU_EDGE_INSET,
      vertical: insets.top + variables.contentHeaderHeight,
    }),
    [windowWidth, menuWidth, insets.top],
  );

  return (
    <ScreenWrapper
      testID={AddFriendsScreen.displayName}
      shouldShowOfflineIndicator={false}>
      <HeaderWithBackButton
        title={translate('addFriendsScreen.title')}
        onBackButtonPress={Navigation.goBack}
        shouldAlignTitleStart
        shouldShowThreeDotsButton={isCodeTab}
        threeDotsAnchorPosition={threeDotsAnchorPosition}
        threeDotsMenuItems={[
          {
            icon: KirokuIcons.RotateLeft,
            text: translate('inviteCode.resetLink'),
            description: translate('inviteCode.resetDescription'),
            onSelected: () => setIsResetModalVisible(true),
            disabled: !hasInviteLink || isOffline || isResetting,
          },
        ]}
      />
      <TabView
        navigationState={{index, routes}}
        onIndexChange={setIndex}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        initialLayout={{width: windowWidth}}
        lazy
        commonOptions={TOP_TAB_COMMON_OPTIONS}
      />
      <ConfirmModal
        isVisible={isResetModalVisible}
        title={translate('inviteCode.resetTitle')}
        prompt={translate('inviteCode.resetPrompt')}
        confirmText={translate('inviteCode.resetConfirm')}
        onConfirm={resetLink}
        onCancel={() => setIsResetModalVisible(false)}
        shouldDisableConfirmButtonWhenOffline
        danger
      />
    </ScreenWrapper>
  );
}

AddFriendsScreen.displayName = 'AddFriendsScreen';
export default AddFriendsScreen;
