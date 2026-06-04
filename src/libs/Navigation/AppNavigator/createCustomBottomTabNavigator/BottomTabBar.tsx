import {View} from 'react-native';
import BottomTabBarIcon from '@components/BottomTabBarIcon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import StartSessionButtonAndPopover from '@components/StartSessionButtonAndPopover';
import useLocalize from '@hooks/useLocalize';
import SCREENS from '@src/SCREENS';

function BottomTabBar() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const selectedTab = null;
  // const selectedTab = SCREENS.SEARCH.BOTTOM_TAB

  return (
    <View style={[styles.bottomTabBarContainer, styles.ph1]}>
      <BottomTabBarIcon
        src={KirokuIcons.Users}
        label={translate('bottomTabBar.friends')}
        isSelected={selectedTab === SCREENS.SOCIAL}
        onPress={() => Navigation.navigate(ROUTES.SOCIAL)}
        accessibilityLabel={translate('bottomTabBar.friends')}
      />
      <BottomTabBarIcon
        src={KirokuIcons.Star}
        label={translate('bottomTabBar.achievements')}
        isSelected={selectedTab === SCREENS.ACHIEVEMENTS}
        onPress={() => Navigation.navigate(ROUTES.ACHIEVEMENTS)}
        accessibilityLabel={translate('bottomTabBar.achievements')}
      />
      <StartSessionButtonAndPopover />
      <BottomTabBarIcon
        src={KirokuIcons.Statistics}
        label={translate('bottomTabBar.statistics')}
        isSelected={selectedTab === SCREENS.STATISTICS}
        onPress={() => Navigation.navigate(ROUTES.STATISTICS)}
        accessibilityLabel={translate('bottomTabBar.statistics')}
      />
      <BottomTabBarIcon
        src={KirokuIcons.Menu}
        label={translate('bottomTabBar.settings')}
        isSelected={selectedTab === SCREENS.SETTINGS}
        onPress={() => Navigation.navigate(ROUTES.SETTINGS)}
        accessibilityLabel={translate('bottomTabBar.settings')}
      />
    </View>
  );
}

export default BottomTabBar;

// TODO original implementation in Expensify - perhaps rewrite the component more in line with this implementation

// import {useNavigation, useNavigationState} from '@react-navigation/native';
// import React, {useEffect} from 'react';
// import {Text, View} from 'react-native';
// // import Icon from '@components/Icon';
// // import {PressableWithFeedback} from '@components/Pressable';
// // import Tooltip from '@components/Tooltip';
// // import useLocalize from '@hooks/useLocalize';
// import useTheme from '@hooks/useTheme';
// import useThemeStyles from '@hooks/useThemeStyles';
// // import interceptAnonymousUser from '@libs/interceptAnonymousUser';
// import getTopmostBottomTabRoute from '@navigation/getTopmostBottomTabRoute';
// import Navigation from '@navigation/Navigation';
// import type {RootStackParamList} from '@navigation/types';
// import variables from '@styles/variables';
// // import * as Welcome from '@userActions/Welcome';
// import CONST from '@src/CONST';
// import NAVIGATORS from '@src/NAVIGATORS';
// import ROUTES from '@src/ROUTES';
// import SCREENS from '@src/SCREENS';

// type BottomTabBarProps = {
//   isLoadingApp?: boolean;
// };

// function BottomTabBar({isLoadingApp = false}: BottomTabBarProps) {
//   const theme = useTheme();
//   const styles = useThemeStyles();
//   //   const {translate} = useLocalize();
//   //   const {activeWorkspaceID} = useActiveWorkspace();

//   const navigation = useNavigation();

//   useEffect(() => {
//     const navigationState = navigation.getState();
//     const routes = navigationState.routes;
//     const currentRoute = routes[navigationState.index];

//     if (
//       currentRoute &&
//       currentRoute.name !== NAVIGATORS.BOTTOM_TAB_NAVIGATOR &&
//       currentRoute.name !== NAVIGATORS.CENTRAL_PANE_NAVIGATOR
//     ) {
//       return;
//     }

//     // TODO implement this
//     // Welcome.show(routes, () => Navigation.navigate(ROUTES.ONBOARD));
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [isLoadingApp]);

//   // Parent navigator of the bottom tab bar is the root navigator.
//   const currentTabName = useNavigationState<
//     RootStackParamList,
//     string | undefined
//   >(state => {
//     const topmostBottomTabRoute = getTopmostBottomTabRoute(state);
//     return topmostBottomTabRoute?.name ?? SCREENS.HOME;
//   });

//   //   const shouldShowWorkspaceRedBrickRoad =
//   //     checkIfWorkspaceSettingsTabHasRBR(activeWorkspaceID) &&
//   //     currentTabName === SCREENS.HOME;

//   //   const chatTabBrickRoad =
//   //     currentTabName !== SCREENS.HOME
//   //       ? getChatTabBrickRoad(activeWorkspaceID)
//   //       : undefined;

//   return (
//     <View style={styles.bottomTabBarContainer}>
//       <Text>Hello, world!</Text>
//       {/* <Tooltip text={translate('common.chats')}>
//         <PressableWithFeedback
//           onPress={() => {
//             Navigation.navigate(ROUTES.HOME);
//           }}
//           role={CONST.ROLE.BUTTON}
//           accessibilityLabel={translate('common.chats')}
//           wrapperStyle={styles.flexGrow1}
//           style={styles.bottomTabBarItem}>
//           <View>
//             <Icon
//               src={Expensicons.ChatBubble}
//               fill={
//                 currentTabName === SCREENS.HOME ? theme.iconMenu : theme.icon
//               }
//               width={variables.iconBottomBar}
//               height={variables.iconBottomBar}
//             />
//             {chatTabBrickRoad && (
//               <View
//                 style={styles.bottomTabStatusIndicator(
//                   chatTabBrickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.INFO
//                     ? theme.iconSuccessFill
//                     : theme.danger,
//                 )}
//               />
//             )}
//           </View>
//         </PressableWithFeedback>
//       </Tooltip> */}
//       {/* <BottomTabBarFloatingActionButton /> */}
//       {/* <Tooltip text={translate('common.settings')}>
//         <PressableWithFeedback
//           onPress={() =>
//             interceptAnonymousUser(() =>
//               activeWorkspaceID
//                 ? Navigation.navigate(
//                     ROUTES.WORKSPACE_INITIAL.getRoute(activeWorkspaceID),
//                   )
//                 : Navigation.navigate(ROUTES.ALL_SETTINGS),
//             )
//           }
//           role={CONST.ROLE.BUTTON}
//           accessibilityLabel={translate('common.settings')}
//           wrapperStyle={styles.flexGrow1}
//           style={styles.bottomTabBarItem}>
//           <View>
//             <Icon
//               src={Expensicons.Wrench}
//               fill={
//                 currentTabName === SCREENS.ALL_SETTINGS ||
//                 currentTabName === SCREENS.WORKSPACE.INITIAL
//                   ? theme.iconMenu
//                   : theme.icon
//               }
//               width={variables.iconBottomBar}
//               height={variables.iconBottomBar}
//             />
//             {shouldShowWorkspaceRedBrickRoad && (
//               <View style={styles.bottomTabStatusIndicator(theme.danger)} />
//             )}
//           </View>
//         </PressableWithFeedback>
//       </Tooltip> */}
//     </View>
//   );
// }

// BottomTabBar.displayName = 'BottomTabBar';

// export default BottomTabBar;

// // export default withOnyx<
// //   PurposeForUsingExpensifyModalProps,
// //   PurposeForUsingExpensifyModalOnyxProps
// // >({
// //   isLoadingApp: {
// //     key: ONYXKEYS.IS_LOADING_APP,
// //   },
// // })(BottomTabBar);
