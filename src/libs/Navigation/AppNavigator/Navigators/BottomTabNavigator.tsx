import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useNavigationState} from '@react-navigation/native';
import React from 'react';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
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
 * The bottom tab navigator, shared across web, iOS, and Android.
 *
 * We use the JS `@react-navigation/bottom-tabs` with a custom `tabBar`
 * (`BottomTabBar`) on every platform, rather than the native
 * `react-native-bottom-tabs`. The native iOS 26 (Liquid Glass) bar plays a
 * system tab-switch zoom/cross-dissolve that scales the outgoing screen into
 * the corner, and it cannot be disabled through any public API: the library's
 * `disablePageAnimations` prop, a SwiftUI `.transaction`, and a zero-duration
 * `UITabBarControllerDelegate` all proved ineffective on-device (see upstream
 * callstack/react-native-bottom-tabs#430). `animation: 'none'` on the JS
 * navigator makes tab switches an instant cut on every platform. The screen
 * list, labels, and icons come from `bottomTabConfig`.
 */
const Tab = createBottomTabNavigator();

// `@react-navigation/bottom-tabs` invokes the `tabBar` prop as a plain function
// inside a `SafeAreaInsetsContext.Consumer` render prop, so passing the bar
// component directly would run its hooks outside a component fiber ("Invalid
// hook call"). Render it as a real element instead, via a stable reference.
function renderTabBar(props: BottomTabBarProps) {
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <BottomTabBar {...props} />;
}

function BottomTabNavigator() {
  const {translate} = useLocalize();
  const theme = useTheme();
  const activeRoute = useNavigationState<
    RootStackParamList,
    NavigationPartialRoute<CentralPaneName> | undefined
  >(getTopmostCentralPaneRoute);

  return (
    <ActiveCentralPaneRouteContext.Provider value={activeRoute}>
      <Tab.Navigator
        initialRouteName={SCREENS.HOME}
        screenOptions={{
          headerShown: false,
          // Instant tab switch on every platform: no native zoom, no JS fade.
          animation: 'none',
          lazy: true,
          // Keep each tab root mounted but frozen while blurred, so switching
          // back is instant and cheap.
          freezeOnBlur: true,
          // Opaque scene background so switching tabs never shows the previous
          // screen through during the swap.
          sceneStyle: {backgroundColor: theme.appBG},
        }}
        tabBar={renderTabBar}>
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
