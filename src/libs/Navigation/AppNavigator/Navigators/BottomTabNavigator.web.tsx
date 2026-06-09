import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useNavigationState} from '@react-navigation/native';
import React from 'react';
import useLocalize from '@hooks/useLocalize';
import BottomTabBar from '@navigation/AppNavigator/createCustomBottomTabNavigator/BottomTabBar';
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
 * The web bottom tab navigator. `react-native-bottom-tabs` (the native
 * implementation used on iOS/Android) does not run on web, so web renders a
 * custom JS tab bar via `@react-navigation/bottom-tabs` with a `tabBar`
 * override. The screen list, labels, and icons come from `bottomTabConfig`, so
 * web stays in sync with native.
 */
const Tab = createBottomTabNavigator();

function BottomTabNavigator() {
  const {translate} = useLocalize();
  const activeRoute = useNavigationState<
    RootStackParamList,
    NavigationPartialRoute<CentralPaneName> | undefined
  >(getTopmostCentralPaneRoute);

  return (
    <ActiveCentralPaneRouteContext.Provider value={activeRoute}>
      <Tab.Navigator
        initialRouteName={SCREENS.HOME}
        screenOptions={{headerShown: false}}
        tabBar={props => <BottomTabBar {...props} />}>
        {BOTTOM_TAB_CONFIG.map(tab => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            getComponent={tab.getComponent}
            options={{tabBarLabel: translate(tab.labelKey)}}
          />
        ))}
      </Tab.Navigator>
    </ActiveCentralPaneRouteContext.Provider>
  );
}
BottomTabNavigator.displayName = 'BottomTabNavigator';

export default BottomTabNavigator;
