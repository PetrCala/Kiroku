import NAVIGATORS from '@src/NAVIGATORS';
import type {State} from './types';

/**
 * Computes the `StackActions.pop` target that pops the topmost modal flow off,
 * landing on whatever is beneath it (e.g. the Day Overview), or `undefined` when
 * the top root route is not a modal navigator (popModalFlow should then no-op).
 *
 * The modal navigator (RIGHT/LEFT_MODAL_NAVIGATOR) is the LAST route of the ROOT
 * stack; the screen the user expects to return to — the Day Overview — is a
 * SIBLING root navigator sitting beneath it, NOT a flow nested inside the modal.
 * Two cases follow:
 *  - The modal holds more than one flow group stacked (its inner `index > 0`):
 *    target the inner stack so the pop reveals the flow beneath, keeping the
 *    modal open — the documented "pop only the top flow" behaviour.
 *  - The modal holds a single flow (inner `index === 0` — e.g. DrinkingSession =
 *    Summary + Edit): a pop targeted at the inner stack is a structural no-op,
 *    because `StackActions.pop` clamps at the focused navigator's own first route
 *    and never crosses out of it (`StackRouter` returns `null` when the inner
 *    index is 0). That no-op is exactly what stranded save/delete on the Edit
 *    screen. Target the ROOT instead so the whole modal navigator comes off and
 *    the sibling root navigator beneath it (the Day Overview) takes focus — the
 *    same mechanism `dismissModal` uses.
 *
 * @returns The dispatch target key, or undefined when there is no modal flow to
 * pop.
 */
function getPopModalFlowTarget(
  rootState: State | undefined,
): string | undefined {
  const routes = rootState?.routes;
  const modalNavigatorRoute = routes?.[routes.length - 1];
  if (
    !modalNavigatorRoute?.state?.key ||
    (modalNavigatorRoute.name !== NAVIGATORS.RIGHT_MODAL_NAVIGATOR &&
      modalNavigatorRoute.name !== NAVIGATORS.LEFT_MODAL_NAVIGATOR)
  ) {
    return undefined;
  }
  const modalState = modalNavigatorRoute.state;
  return (modalState.index ?? 0) > 0 ? modalState.key : rootState?.key;
}

export default getPopModalFlowTarget;
