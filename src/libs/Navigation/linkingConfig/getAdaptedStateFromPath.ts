import type {
  NavigationState,
  PartialState,
  Route,
} from '@react-navigation/native';
import {findFocusedRoute, getStateFromPath} from '@react-navigation/native';
import pick from 'lodash/pick';
import getIsNarrowLayout from '@libs/getIsNarrowLayout';
import type {
  BottomTabName,
  CentralPaneName,
  NavigationPartialRoute,
  RootStackParamList,
} from '@libs/Navigation/types';
import {isCentralPaneName} from '@libs/NavigationUtils';
import NAVIGATORS from '@src/NAVIGATORS';
import type {Screen} from '@src/SCREENS';
import SCREENS from '@src/SCREENS';
import config, {normalizedConfigs} from './config';
import getMatchingBottomTabRouteForState from './getMatchingBottomTabRouteForState';
import getMatchingCentralPaneRouteForState from './getMatchingCentralPaneRouteForState';
import replacePathInNestedState from './replacePathInNestedState';
import CENTRAL_PANE_TO_RHP_MAPPING from './CENTRAL_PANE_TO_RHP_MAPPING';

type Metainfo = {
  // Sometimes modal screens don't have information about what should be visible under the overlay.
  // That means such screen can have different screens under the overlay depending on what was already in the state.
  // If the screens in the bottom tab and central pane are not mandatory for this state, we want to have this information.
  // It will help us later with creating proper diff betwen current and desired state.
  isCentralPaneAndBottomTabMandatory: boolean;
  // isFullScreenNavigatorMandatory: boolean;
};

type GetAdaptedStateReturnType = {
  adaptedState: ReturnType<typeof getStateFromPath>;
  metainfo: Metainfo;
};

type GetAdaptedStateFromPath = (
  ...args: Parameters<typeof getStateFromPath>
) => GetAdaptedStateReturnType;

// The function getPathFromState that we are using in some places isn't working correctly without defined index.
const getRoutesWithIndex = (
  routes: NavigationPartialRoute[],
): PartialState<NavigationState> => ({routes, index: routes.length - 1});

const addPolicyIDToRoute = (
  route: NavigationPartialRoute,
  policyID?: string,
) => {
  const routeWithPolicyID = {...route};
  if (!routeWithPolicyID.params) {
    routeWithPolicyID.params = {policyID};
    return routeWithPolicyID;
  }

  if (
    'policyID' in routeWithPolicyID.params &&
    !!routeWithPolicyID.params.policyID
  ) {
    return routeWithPolicyID;
  }

  routeWithPolicyID.params = {...routeWithPolicyID.params, policyID};

  return routeWithPolicyID;
};

function createBottomTabNavigator(
  route: NavigationPartialRoute<BottomTabName>,
  policyID?: string,
): NavigationPartialRoute<typeof NAVIGATORS.BOTTOM_TAB_NAVIGATOR> {
  const routesForBottomTabNavigator: Array<
    NavigationPartialRoute<BottomTabName>
  > = [];
  routesForBottomTabNavigator.push(
    addPolicyIDToRoute(
      route,
      policyID,
    ) as NavigationPartialRoute<BottomTabName>,
  );

  return {
    name: NAVIGATORS.BOTTOM_TAB_NAVIGATOR,
    state: getRoutesWithIndex(routesForBottomTabNavigator),
  };
}

// function getParamsFromRoute(screenName: string): string[] {
//   const routeConfig = normalizedConfigs[screenName as Screen];

//   const route = routeConfig.pattern;

//   return route.match(/(?<=[:?&])(\w+)(?=[/=?&]|$)/g) ?? [];
// }

// This function will return CentralPaneNavigator route or FullScreenNavigator route.
function getMatchingRootRouteForRHPRoute(
  route: NavigationPartialRoute,
):
  | NavigationPartialRoute<
      CentralPaneName | typeof NAVIGATORS.FULL_SCREEN_NAVIGATOR
    >
  | undefined {
  // Check for backTo param. One screen with different backTo value may need diferent screens visible under the overlay.
  if (
    route.params &&
    'backTo' in route.params &&
    typeof route.params.backTo === 'string'
  ) {
    const stateForBackTo = getStateFromPath(route.params.backTo, config);
    if (stateForBackTo) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const rhpNavigator = stateForBackTo.routes.find(
        route => route.name === NAVIGATORS.RIGHT_MODAL_NAVIGATOR,
      );

      const centralPaneOrFullScreenNavigator = stateForBackTo.routes.find(
        // eslint-disable-next-line @typescript-eslint/no-shadow
        route =>
          isCentralPaneName(route.name) ||
          route.name === NAVIGATORS.FULL_SCREEN_NAVIGATOR,
      );

      // If there is rhpNavigator in the state generated for backTo url, we want to get root route matching to this rhp screen.
      if (rhpNavigator && rhpNavigator.state) {
        return getMatchingRootRouteForRHPRoute(
          findFocusedRoute(stateForBackTo) as NavigationPartialRoute,
        );
      }

      // If we know that backTo targets the root route (central pane or full screen) we want to use it.
      if (
        centralPaneOrFullScreenNavigator &&
        centralPaneOrFullScreenNavigator.state
      ) {
        return centralPaneOrFullScreenNavigator as NavigationPartialRoute<
          CentralPaneName | typeof NAVIGATORS.FULL_SCREEN_NAVIGATOR
        >;
      }
    }
  }

  // Check for CentralPaneNavigator
  // for (const [centralPaneName, RHPNames] of Object.entries(
  //   CENTRAL_PANE_TO_RHP_MAPPING,
  // )) {
  //   if (RHPNames.includes(route.name)) {
  //     const paramsFromRoute = getParamsFromRoute(centralPaneName);

  //     return {
  //       name: centralPaneName as CentralPaneName,
  //       params: pick(route.params, paramsFromRoute),
  //     };
  //   }
  // }
}

function getAdaptedState(
  state: PartialState<NavigationState<RootStackParamList>>,
): GetAdaptedStateReturnType {
  const isNarrowLayout = getIsNarrowLayout();
  const metainfo = {
    isCentralPaneAndBottomTabMandatory: true,
    isFullScreenNavigatorMandatory: true,
  };

  // We need to check what is defined to know what we need to add.
  const bottomTabNavigator = state.routes.find(
    route => route.name === NAVIGATORS.BOTTOM_TAB_NAVIGATOR,
  );
  const centralPaneNavigator = state.routes.find(route =>
    isCentralPaneName(route.name),
  );
  const rhpNavigator = state.routes.find(
    route => route.name === NAVIGATORS.RIGHT_MODAL_NAVIGATOR,
  );
  const lhpNavigator = state.routes.find(
    route => route.name === NAVIGATORS.LEFT_MODAL_NAVIGATOR,
  );
  const tzFixNavigator = state.routes.find(
    route => route.name === NAVIGATORS.TZ_FIX_NAVIGATOR,
  );
  // const onboardingModalNavigator = state.routes.find((route) => route.name === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR);

  if (rhpNavigator) {
    // Routes
    // - matching bottom tab
    // - matching root route for rhp
    // - found rhp

    // This one will be defined because rhpNavigator is defined.
    const focusedRHPRoute = findFocusedRoute(state);
    const routes = [];

    if (focusedRHPRoute) {
      let matchingRootRoute = getMatchingRootRouteForRHPRoute(focusedRHPRoute);
      const isRHPScreenOpenedFromLHN = focusedRHPRoute?.name;
      //  && RHP_SCREENS_OPENED_FROM_LHN.includes(
      //   focusedRHPRoute?.name as RHPScreenOpenedFromLHN,
      // );
      // This may happen if this RHP doens't have a route that should be under the overlay defined.
      if (!matchingRootRoute || isRHPScreenOpenedFromLHN) {
        metainfo.isCentralPaneAndBottomTabMandatory = false;
        metainfo.isFullScreenNavigatorMandatory = false;
      }

      // If the root route is type of FullScreenNavigator, the default bottom tab will be added.
      const matchingBottomTabRoute = getMatchingBottomTabRouteForState({
        // routes: matchingRootRoute ? [matchingRootRoute] : [],
        routes: [], // TODO validate this
      });
      routes.push(createBottomTabNavigator(matchingBottomTabRoute));

      if (matchingRootRoute && (!isNarrowLayout || !isRHPScreenOpenedFromLHN)) {
        routes.push(matchingRootRoute);
      }
    }

    routes.push(rhpNavigator);
    return {
      adaptedState: getRoutesWithIndex(routes),
      metainfo,
    };
  }
  if (lhpNavigator ?? tzFixNavigator) {
    // ?OnboardingNavigator
    // Routes
    // - default bottom tab
    // - default central pane on desktop layout
    // - found lhp / onboardingModalNavigator

    // There is no screen in these navigators that would have mandatory central pane, bottom tab or fullscreen navigator.
    metainfo.isCentralPaneAndBottomTabMandatory = false;
    // metainfo.isFullScreenNavigatorMandatory = false;
    const routes = [];
    routes.push(
      createBottomTabNavigator({
        name: SCREENS.HOME,
      }),
    );

    // Separate ifs are necessary for typescript to see that we are not pushing undefined to the array.
    if (lhpNavigator) {
      routes.push(lhpNavigator);
    }

    if (tzFixNavigator) {
      routes.push(tzFixNavigator);
    }

    // if (onboardingModalNavigator) {
    //     routes.push(onboardingModalNavigator);
    // }

    return {
      adaptedState: getRoutesWithIndex(routes),
      metainfo,
    };
  }
  if (centralPaneNavigator) {
    // Routes
    // - matching bottom tab
    // - found central pane
    const routes = [];
    const matchingBottomTabRoute = getMatchingBottomTabRouteForState(state);
    routes.push(createBottomTabNavigator(matchingBottomTabRoute));
    routes.push(centralPaneNavigator);

    return {
      adaptedState: getRoutesWithIndex(routes),
      metainfo,
    };
  }

  // We need to make sure that this if only handles states where we deeplink to the bottom tab directly
  if (bottomTabNavigator && bottomTabNavigator.state) {
    // Routes
    // - found bottom tab
    // - matching central pane on desktop layout

    // We want to make sure that the bottom tab search page is always pushed with matching central pane page. Even on the narrow layout.
    if (isNarrowLayout) {
      return {
        adaptedState: state,
        metainfo,
      };
    }

    const routes = [...state.routes];
    const matchingCentralPaneRoute = getMatchingCentralPaneRouteForState(state);
    if (matchingCentralPaneRoute) {
      routes.push(matchingCentralPaneRoute);
    }
    //  else {
    //   // If there is no matching central pane, we want to add the default one.
    //   metainfo.isCentralPaneAndBottomTabMandatory = false;
    //   routes.push({name: SCREENS.REPORT});
    // }

    return {
      adaptedState: getRoutesWithIndex(routes),
      metainfo,
    };
  }

  return {
    adaptedState: state,
    metainfo,
  };
}

const getAdaptedStateFromPath: GetAdaptedStateFromPath = (path, options) => {
  const normalizedPath = !path.startsWith('/') ? `/${path}` : path;

  const state = getStateFromPath(normalizedPath, options) as PartialState<
    NavigationState<RootStackParamList>
  >;
  replacePathInNestedState(state, path);
  if (state === undefined) {
    throw new Error('Unable to parse path');
  }

  return getAdaptedState(state);
};

export default getAdaptedStateFromPath;
export type {Metainfo};
