import type {
  ParamListBase,
  StackActionHelpers,
  StackNavigationState,
} from '@react-navigation/native';
import {
  createNavigatorFactory,
  useLocale,
  useNavigationBuilder,
} from '@react-navigation/native';
import type {
  StackNavigationEventMap,
  StackNavigationOptions,
} from '@react-navigation/stack';
import {StackView} from '@react-navigation/stack';
import React, {useEffect, useMemo} from 'react';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import navigationRef from '@libs/Navigation/navigationRef';
import {isCentralPaneName} from '@libs/NavigationUtils';
import CustomRouter from './CustomRouter';
import type {
  ResponsiveStackNavigatorProps,
  ResponsiveStackNavigatorRouterOptions,
} from './types';

type Routes = StackNavigationState<ParamListBase>['routes'];
function reduceCentralPaneRoutes(routes: Routes): Routes {
  const result: Routes = [];
  let count = 0;
  const reverseRoutes = [...routes].reverse();

  reverseRoutes.forEach(route => {
    if (isCentralPaneName(route.name)) {
      // Remove all central pane routes except the last 3. This will improve performance.
      if (count < 3) {
        result.push(route);
        count++;
      }
    } else {
      result.push(route);
    }
  });

  return result.reverse();
}

function ResponsiveStackNavigator(props: ResponsiveStackNavigatorProps) {
  const {shouldUseNarrowLayout} = useResponsiveLayout();
  const {direction} = useLocale();

  const {navigation, state, descriptors, describe, NavigationContent} =
    useNavigationBuilder<
      StackNavigationState<ParamListBase>,
      ResponsiveStackNavigatorRouterOptions,
      StackActionHelpers<ParamListBase>,
      StackNavigationOptions,
      StackNavigationEventMap
    >(CustomRouter, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      children: props.children,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      screenOptions: props.screenOptions,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      initialRouteName: props.initialRouteName,
    });

  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    navigationRef.resetRoot(navigationRef.getRootState());
  }, [shouldUseNarrowLayout]);

  const {stateToRender} = useMemo(() => {
    const routes = reduceCentralPaneRoutes(state.routes);

    return {
      stateToRender: {
        ...state,
        index: routes.length - 1,
        routes: [...routes],
      },
    };
  }, [state]);

  return (
    <NavigationContent>
      <StackView
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
        state={stateToRender}
        descriptors={descriptors}
        navigation={navigation}
        direction={direction}
        describe={describe}
      />
      {/* {searchRoute && (
        <View style={styles.dNone}>
          {descriptors[searchRoute.key].render()}
        </View>
      )} */}
    </NavigationContent>
  );
}

ResponsiveStackNavigator.displayName = 'ResponsiveStackNavigator';

export default createNavigatorFactory(ResponsiveStackNavigator);
