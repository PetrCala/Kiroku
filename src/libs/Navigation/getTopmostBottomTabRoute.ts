import NAVIGATORS from '@src/NAVIGATORS';
import type {
  BottomTabName,
  NavigationPartialRoute,
  RootStackParamList,
  State,
} from './types';

function getTopmostBottomTabRoute(
  state: State<RootStackParamList> | undefined,
): NavigationPartialRoute<BottomTabName> | undefined {
  const bottomTabNavigatorRoute = state?.routes
    .slice()
    .reverse()
    .find(route => route.name === NAVIGATORS.BOTTOM_TAB_NAVIGATOR); // findLast

  // The bottomTabNavigatorRoute state may be empty if we just logged in.
  if (
    !bottomTabNavigatorRoute ||
    bottomTabNavigatorRoute.name !== NAVIGATORS.BOTTOM_TAB_NAVIGATOR ||
    bottomTabNavigatorRoute.state === undefined
  ) {
    return undefined;
  }

  // The bottom tab navigator is a TabRouter: its routes are in fixed tab order
  // and the active tab is `state.index` (not the last route, as it would be for
  // a stack). Fall back to the last route if `index` is absent.
  const tabState = bottomTabNavigatorRoute.state;
  const topmostBottomTabRoute =
    tabState.routes[tabState.index ?? tabState.routes.length - 1];

  if (!topmostBottomTabRoute) {
    throw new Error('BottomTabNavigator route have no routes.');
  }

  return {
    name: topmostBottomTabRoute.name as BottomTabName,
    params: topmostBottomTabRoute.params,
  };
}

export default getTopmostBottomTabRoute;
