import {createNativeBottomTabNavigator} from '@bottom-tabs/react-navigation';
import type {NativeBottomTabNavigationOptions} from '@bottom-tabs/react-navigation';
import {useNavigationState} from '@react-navigation/native';
import {isLiquidGlassAvailable} from 'expo-glass-effect';
import React from 'react';
import {Platform} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import FontUtils from '@styles/utils/FontUtils';
import variables from '@styles/variables';
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

// iOS 26 ships a native Liquid Glass tab bar; older iOS and Android do not. The
// value is fixed for the session, so it's evaluated once at module load.
const SUPPORTS_LIQUID_GLASS = isLiquidGlassAvailable();

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
        tabBarInactiveTintColor={theme.icon}
        // Android Material tab bar only: theme the active-indicator "pill" and
        // touch ripple. Otherwise they fall back to Material's default light
        // `colorSecondaryContainer`, which shows as a bright hue behind the
        // selected tab in the dark theme. Both are no-ops on iOS.
        activeIndicatorColor={theme.activeComponentBG}
        rippleColor={theme.hoverComponentBG}
        // On iOS 26, let the system render its native Liquid Glass tab bar: it
        // gives the items the roomier, vertically-centered spacing of modern iOS
        // (the legacy opaque appearance looked vertically squashed). On older iOS
        // we keep the opaque dark bar that matches the app theme and avoided the
        // bright translucent default that flashed white on tab change.
        // `backgroundColor` themes the Android bar and is a no-op on iOS 26,
        // where the glass bar adapts to the content behind it.
        tabBarStyle={{backgroundColor: theme.appBG}}
        translucent={SUPPORTS_LIQUID_GLASS}
        scrollEdgeAppearance={SUPPORTS_LIQUID_GLASS ? 'default' : 'opaque'}
        disablePageAnimations
        // Match the rest of the app's typography on the native labels.
        tabLabelStyle={{
          fontFamily: FontUtils.fontFamily.platform.EXP_NEUE.fontFamily,
          fontSize: variables.fontSizeSmall,
        }}>
        {BOTTOM_TAB_CONFIG.map(tab => {
          const options: NativeBottomTabNavigationOptions = {
            tabBarLabel: translate(tab.labelKey),
            tabBarIcon: () =>
              Platform.OS === 'ios'
                ? {sfSymbol: tab.sfSymbol}
                : tab.androidIcon,
            freezeOnBlur: true,
            // Opaque scene background so the previous tab never shows through
            // during a switch — the swap reads as instant.
            sceneStyle: {backgroundColor: theme.appBG},
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
