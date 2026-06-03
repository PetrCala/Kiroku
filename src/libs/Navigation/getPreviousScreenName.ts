import type {State} from './types';

/**
 * Walks a navigation state down to its innermost active stack and returns the
 * name of the route directly below the focused screen — the screen the user
 * came from within that stack. Unlike `getLastScreenName`, this reads the real
 * screen routes (e.g. the DrinkingSession navigator's Summary/Edit), not the
 * modal-level `params.screen`.
 *
 * The descent follows the *last* route at each level rather than `state.index`,
 * mirroring `getLastScreenName`. In the split (central pane + RHP) layout the
 * root's `index` points at the central pane, not the RHP overlaid on top — so
 * following `index` would walk into the wrong branch and never reach the
 * focused modal's stack. The RHP → modal → screen path is all stacks, where the
 * last route is the focused (topmost) one.
 *
 * @returns The previous screen's route name, or undefined if the focused screen
 * is the first one in its stack.
 */
function getPreviousScreenName(state: State): string | undefined {
  const focusedRoute = state.routes[state.routes.length - 1];
  if (focusedRoute?.state) {
    return getPreviousScreenName(focusedRoute.state);
  }
  return state.routes[state.routes.length - 2]?.name;
}

export default getPreviousScreenName;
