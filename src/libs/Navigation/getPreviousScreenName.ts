import type {State} from './types';

/**
 * Walks a navigation state down to its innermost active stack and returns the
 * name of the route directly below the focused screen — the screen the user
 * came from within that stack. Unlike `getLastScreenName`, this reads the real
 * screen routes (e.g. the DrinkingSession navigator's Summary/Edit), not the
 * modal-level `params.screen`.
 *
 * @returns The previous screen's route name, or undefined if the focused screen
 * is the first one in its stack.
 */
function getPreviousScreenName(state: State): string | undefined {
  const index = state.index ?? state.routes.length - 1;
  const focusedRoute = state.routes[index];
  if (focusedRoute?.state) {
    return getPreviousScreenName(focusedRoute.state);
  }
  return state.routes[index - 1]?.name;
}

export default getPreviousScreenName;
