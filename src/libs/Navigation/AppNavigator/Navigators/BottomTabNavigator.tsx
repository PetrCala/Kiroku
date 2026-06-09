import {createNativeBottomTabNavigator} from '@bottom-tabs/react-navigation';
import type {NativeBottomTabNavigationOptions} from '@bottom-tabs/react-navigation';
import {useNavigationState} from '@react-navigation/native';
import React from 'react';
import {Platform} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import getTopmostCentralPaneRoute from '@navigation/getTopmostCentralPaneRoute';
import type {
  CentralPaneName,
  NavigationPartialRoute,
  RootStackParamList,
} from '@navigation/types';
import SCREENS from '@src/SCREENS';
import BOTTOM_TAB_CONFIG from './bottomTabConfig';
import ActiveCentralPaneRouteContext from './ActiveRouteContext';

/**
 * The bottom tab navigator backed by `react-native-bottom-tabs`, which renders a
 * native `UITabBarController` on iOS (Liquid Glass) and a native Material tab bar
 * on Android. Switching tabs is instant — each tab root stays mounted (and is
 * frozen while blurred) — and is tap-only, with no swipe between tabs.
 *
 * The web counterpart (`BottomTabNavigator.web.tsx`) renders a custom JS tab bar
 * instead, since the native component does not run on web. Both share the screen
 * list, labels, and icons from `bottomTabConfig`.
 */
const Tab = createNativeBottomTabNavigator();

function BottomTabNavigator() {
  const theme = useTheme();
  const {translate} = useLocalize();
  const activeRoute = useNavigationState<
    RootStackParamList,
    NavigationPartialRoute<CentralPaneName> | undefined
  >(getTopmostCentralPaneRoute);

  return (
    <ActiveCentralPaneRouteContext.Provider value={activeRoute}>
      <Tab.Navigator
        initialRouteName={SCREENS.HOME}
        tabBarActiveTintColor={theme.appColor}
        tabBarInactiveTintColor={theme.icon}>
        {BOTTOM_TAB_CONFIG.map(tab => {
          const options: NativeBottomTabNavigationOptions = {
            tabBarLabel: translate(tab.labelKey),
            tabBarIcon: () =>
              Platform.OS === 'ios'
                ? {sfSymbol: tab.sfSymbol}
                : tab.androidIcon,
            freezeOnBlur: true,
          };
          return (
            <Tab.Screen
              key={tab.name}
              name={tab.name}
              getComponent={tab.getComponent}
              options={options}
            />
          );
        })}
      </Tab.Navigator>
    </ActiveCentralPaneRouteContext.Provider>
  );
}
BottomTabNavigator.displayName = 'BottomTabNavigator';

export default BottomTabNavigator;
