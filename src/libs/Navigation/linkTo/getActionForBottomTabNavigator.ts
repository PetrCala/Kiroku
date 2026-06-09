import type {NavigationAction, NavigationState} from '@react-navigation/native';
import type {Writable} from 'type-fest';
import type {
  RootStackParamList,
  StackNavigationAction,
} from '@libs/Navigation/types';
import getTopmostBottomTabRoute from '@navigation/getTopmostBottomTabRoute';
import CONST from '@src/CONST';
import type {ActionPayloadParams} from './types';

// Because we need to change the type to push, we also need to set target for this action to the bottom tab navigator.
function getActionForBottomTabNavigator(
  action: StackNavigationAction,
  state: NavigationState<RootStackParamList>,
  shouldNavigate?: boolean,
): Writable<NavigationAction> | undefined {
  const bottomTabNavigatorRoute = state.routes.at(0);
  if (
    !bottomTabNavigatorRoute ||
    bottomTabNavigatorRoute.state === undefined ||
    !action ||
    action.type !== CONST.NAVIGATION.ACTION_TYPE.NAVIGATE
  ) {
    return;
  }

  const params = action.payload.params as ActionPayloadParams;
  const payloadParams = params.params as Record<string, string | undefined>;
  const screen = params.screen;

  // Check if the current bottom tab is the same as the one we want to navigate to. If it is, we don't need to do anything.
  const bottomTabCurrentTab = getTopmostBottomTabRoute(state);
  // const bottomTabParams = bottomTabCurrentTab?.params as Record<
  //   string,
  //   string | undefined
  // >;

  if (bottomTabCurrentTab?.name === screen && !shouldNavigate) {
    return;
  }

  // The bottom tab navigator is backed by a TabRouter, so switching tabs is a
  // NAVIGATE (jump-to) — not a stack PUSH, which a TabRouter does not handle.
  return {
    type: CONST.NAVIGATION.ACTION_TYPE.NAVIGATE,
    payload: {
      name: screen,
      params: payloadParams,
    },
    target: bottomTabNavigatorRoute.state.key,
  };
}

export default getActionForBottomTabNavigator;
