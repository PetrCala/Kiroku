import getPreviousScreenName from '@libs/Navigation/getPreviousScreenName';
import type {State} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';

type FakeRoute = {
  name: string;
  state?: FakeState;
};

type FakeState = {
  index?: number;
  routes: FakeRoute[];
};

/**
 * Wraps an innermost DrinkingSession stack in the real navigator nesting
 * (RootStack → RightModal → DrinkingSession-modal) so the descent under test
 * mirrors production.
 *
 * The root's `index` deliberately points at the central pane (the bottom-tab
 * navigator), not the RHP — this is how the split layout reports state. The
 * helper must follow the *last* root route (the RHP) regardless, so these
 * fixtures double as a regression guard against an `index`-based descent.
 */
function rootStateWithDrinkingSessionStack(routes: FakeRoute[]): State {
  const state: FakeState = {
    index: 0,
    routes: [
      {name: 'BottomTabNavigator', state: {index: 0, routes: [{name: 'Home'}]}},
      {
        name: 'RightModalNavigator',
        state: {
          index: 0,
          routes: [{name: 'RightModal_DrinkingSession', state: {routes}}],
        },
      },
    ],
  };
  return state;
}

describe('getPreviousScreenName', () => {
  it('returns the summary when an edit screen was opened through it', () => {
    const state = rootStateWithDrinkingSessionStack([
      {name: SCREENS.DRINKING_SESSION.SUMMARY},
      {name: SCREENS.DRINKING_SESSION.EDIT},
    ]);

    expect(getPreviousScreenName(state)).toBe(SCREENS.DRINKING_SESSION.SUMMARY);
  });

  it('returns undefined when the edit screen is the only one in its stack', () => {
    const state = rootStateWithDrinkingSessionStack([
      {name: SCREENS.DRINKING_SESSION.EDIT},
    ]);

    expect(getPreviousScreenName(state)).toBeUndefined();
  });

  it('follows the RHP (last root route) even when the root index points elsewhere', () => {
    // The root index points at the central pane (BottomTabNavigator); an
    // index-based descent would walk into Home and miss the modal entirely.
    const state = rootStateWithDrinkingSessionStack([
      {name: SCREENS.DRINKING_SESSION.SUMMARY},
      {name: SCREENS.DRINKING_SESSION.EDIT},
    ]);

    expect(state.index).toBe(0);
    expect(getPreviousScreenName(state)).toBe(SCREENS.DRINKING_SESSION.SUMMARY);
  });
});
