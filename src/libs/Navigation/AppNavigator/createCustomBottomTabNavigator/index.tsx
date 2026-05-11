import type {
  DefaultNavigatorOptions,
  ParamListBase,
  StackActionHelpers,
  StackNavigationState,
  StackRouterOptions,
} from '@react-navigation/native';
import {
  createNavigatorFactory,
  StackRouter,
  useNavigationBuilder,
} from '@react-navigation/native';
import type {
  StackNavigationEventMap,
  StackNavigationOptions,
} from '@react-navigation/stack';
import {StackView} from '@react-navigation/stack';
import React from 'react';
import {View} from 'react-native';
// import ScreenWrapper from '@components/ScreenWrapper';
import useThemeStyles from '@hooks/useThemeStyles';
import type {NavigationStateRoute} from '@navigation/types';
import SCREENS from '@src/SCREENS';
import ScreenWrapper from '@components/ScreenWrapper';
// import BottomTabBar from './BottomTabBar';
// import TopBar from './TopBar';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type CustomNavigatorProps = DefaultNavigatorOptions<
  ParamListBase,
  StackNavigationState<ParamListBase>,
  StackNavigationOptions,
  StackNavigationEventMap
> & {
  initialRouteName: string;
};

function getStateToRender(
  state: StackNavigationState<ParamListBase>,
): StackNavigationState<ParamListBase> {
  const routesToRender = [
    state.routes[state.routes.length - 1],
  ] as NavigationStateRoute[];

  // We need to render at least one HOME screen to make sure everything load properly. This may be not necessary after changing how IS_SIDEBAR_LOADED is handled.
  // Currently this value will be switched only after the first HOME screen is rendered.
  if (routesToRender[0].name !== SCREENS.HOME) {
    const routeToRender = state.routes.find(
      route => route.name === SCREENS.HOME,
    );
    if (routeToRender) {
      routesToRender.unshift(routeToRender);
    }
  }

  return {...state, routes: routesToRender, index: routesToRender.length - 1};
}

function CustomBottomTabNavigator({
  initialRouteName,
  children,
  screenOptions,
  ...props
}: CustomNavigatorProps) {
  const {state, navigation, descriptors, NavigationContent} =
    useNavigationBuilder<
      StackNavigationState<ParamListBase>,
      StackRouterOptions,
      StackActionHelpers<ParamListBase>,
      StackNavigationOptions,
      StackNavigationEventMap
    >(StackRouter, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      children,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      screenOptions,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      initialRouteName,
    });

  const styles = useThemeStyles();
  const stateToRender = getStateToRender(state);
  // const selectedTab = stateToRender.routes.at(-1)?.name;

  return (
    <ScreenWrapper
      testID={CustomBottomTabNavigator.displayName}
      shouldShowOfflineIndicator={false}
      shouldEnableKeyboardAvoidingView={false}
      shouldEnablePickerAvoiding={false}>
      <View style={styles.flex1}>
        {/* <TopBar /> */}
        <NavigationContent>
          <StackView
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
            state={stateToRender}
            descriptors={descriptors}
            navigation={navigation}
          />
        </NavigationContent>
        {/* <BottomTabBar selectedTab={selectedTab} /> */}
      </View>
    </ScreenWrapper>
  );
}

CustomBottomTabNavigator.displayName = 'CustomBottomTabNavigator';

export default createNavigatorFactory(CustomBottomTabNavigator);
