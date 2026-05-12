/* eslint-disable @typescript-eslint/naming-convention */
import {findFocusedRoute} from '@react-navigation/native';
import type {NavigationState, PartialState} from '@react-navigation/native';
import type {RootStackParamList} from '@navigation/types';

function replacePathInNestedState(
  state: PartialState<NavigationState<RootStackParamList>>,
  path: string,
) {
  const found = findFocusedRoute(state);
  if (!found) {
    return;
  }

  (found as {path?: string}).path = path;
}
export default replacePathInNestedState;
