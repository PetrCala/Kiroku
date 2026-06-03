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
 */
function rootStateWithDrinkingSessionStack(routes: FakeRoute[]): State {
  const state: FakeState = {
    index: 1,
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

  it('falls back to the last route when the innermost stack has no index', () => {
    // The innermost stack omits `index`, so the helper must treat the last
    // route as the focused one and return the route below it.
    const state = rootStateWithDrinkingSessionStack([
      {name: SCREENS.DRINKING_SESSION.SUMMARY},
      {name: SCREENS.DRINKING_SESSION.EDIT},
    ]);

    expect(getPreviousScreenName(state)).toBe(SCREENS.DRINKING_SESSION.SUMMARY);
  });
});
