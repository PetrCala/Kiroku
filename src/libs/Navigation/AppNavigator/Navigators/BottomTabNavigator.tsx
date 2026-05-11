import {useNavigationState} from '@react-navigation/native';
import type {StackNavigationOptions} from '@react-navigation/stack';
import React from 'react';
import createCustomBottomTabNavigator from '@navigation/AppNavigator/createCustomBottomTabNavigator';
import getTopmostCentralPaneRoute from '@navigation/getTopmostCentralPaneRoute';
import type {
  BottomTabNavigatorParamList,
  CentralPaneName,
  NavigationPartialRoute,
  RootStackParamList,
} from '@navigation/types';
import SCREENS from '@src/SCREENS';
import HomeScreen from '@screens/HomeScreen';
import ActiveCentralPaneRouteContext from './ActiveRouteContext';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const Tab = createCustomBottomTabNavigator<BottomTabNavigatorParamList>();

const screenOptions: StackNavigationOptions = {
  headerShown: false,
  animationEnabled: false,
};

function BottomTabNavigator() {
  const activeRoute = useNavigationState<
    RootStackParamList,
    NavigationPartialRoute<CentralPaneName> | undefined
  >(getTopmostCentralPaneRoute);
  return (
    <ActiveCentralPaneRouteContext.Provider value={activeRoute}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name={SCREENS.HOME} component={HomeScreen} />
      </Tab.Navigator>
    </ActiveCentralPaneRouteContext.Provider>
  );
}
BottomTabNavigator.displayName = 'BottomTabNavigator';

export default BottomTabNavigator;
