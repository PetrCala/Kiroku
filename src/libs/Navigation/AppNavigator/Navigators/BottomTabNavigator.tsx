import {useNavigationState} from '@react-navigation/native';
import type {StackNavigationOptions} from '@react-navigation/stack';
import React from 'react';
import createCustomBottomTabNavigator from '@navigation/AppNavigator/createCustomBottomTabNavigator';
import getTopmostCentralPaneRoute from '@navigation/getTopmostCentralPaneRoute';
import type {BottomTabNavigatorParamList} from '@navigation/types';
import SCREENS from '@src/SCREENS';
import ActiveRouteContext from './ActiveRouteContext';
import HomeScreen from '@screens/HomeScreen';

// const loadWorkspaceInitialPage = () =>
//   require('../../../../pages/workspace/WorkspaceInitialPage')
//     .default as React.ComponentType;

const Tab = createCustomBottomTabNavigator<BottomTabNavigatorParamList>();

const screenOptions: StackNavigationOptions = {
  headerShown: false,
  animationEnabled: false,
};

function BottomTabNavigator() {
  const activeRoute = useNavigationState(getTopmostCentralPaneRoute);
  return (
    <ActiveRouteContext.Provider value={activeRoute?.name ?? ''}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name={SCREENS.HOME} component={HomeScreen} />
      </Tab.Navigator>
    </ActiveRouteContext.Provider>
  );
}

BottomTabNavigator.displayName = 'BottomTabNavigator';

export default BottomTabNavigator;
