import getPopModalFlowTarget from '@libs/Navigation/getPopModalFlowTarget';
import type {State} from '@libs/Navigation/types';
import NAVIGATORS from '@src/NAVIGATORS';
import SCREENS from '@src/SCREENS';

type FakeRoute = {
  name: string;
  key?: string;
  state?: FakeState;
};

type FakeState = {
  key?: string;
  index?: number;
  routes: FakeRoute[];
};

/**
 * Builds the real runtime tree at delete time: the ROOT stack holds the central
 * pane, the Day Overview as its OWN sibling root navigator, and the RHP modal
 * navigator last (top). The RHP's inner stack holds the single DrinkingSession
 * flow, whose deeper stack is [Summary, Edit]. `innerModalIndex` controls how
 * many flow groups are stacked inside the RHP — 0 for the single-flow case the
 * bug reproduces in, >0 when several flows are stacked.
 */
function buildRootState(innerModalIndex: number): State {
  const state: FakeState = {
    key: 'root-stack-key',
    index: 2,
    routes: [
      {name: NAVIGATORS.BOTTOM_TAB_NAVIGATOR, key: 'bottom-tab-key'},
      {name: NAVIGATORS.DAY_OVERVIEW_NAVIGATOR, key: 'day-overview-key'},
      {
        name: NAVIGATORS.RIGHT_MODAL_NAVIGATOR,
        key: 'right-modal-key',
        state: {
          key: 'right-modal-inner-key',
          index: innerModalIndex,
          routes: [
            {
              name: SCREENS.RIGHT_MODAL.DRINKING_SESSION,
              key: 'drinking-session-flow-key',
              state: {
                key: 'drinking-session-inner-key',
                index: 1,
                routes: [
                  {name: SCREENS.DRINKING_SESSION.SUMMARY},
                  {name: SCREENS.DRINKING_SESSION.EDIT},
                ],
              },
            },
          ],
        },
      },
    ],
  };
  return state as State;
}

describe('getPopModalFlowTarget', () => {
  it('targets the ROOT key when the modal holds a single flow', () => {
    // The RHP inner stack is at index 0 (only the DrinkingSession flow). A pop
    // targeted at the inner stack would be a structural no-op (StackRouter
    // clamps POP at the navigator's first route), so the target must be the
    // ROOT — that removes the modal navigator and lands on the Day Overview
    // sibling navigator beneath it.
    expect(getPopModalFlowTarget(buildRootState(0))).toBe('root-stack-key');
  });

  it('targets the inner modal stack key when several flows are stacked', () => {
    // With more than one flow group stacked inside the RHP (inner index > 0),
    // popping the inner stack reveals the flow beneath while keeping the modal
    // open — preserving the documented "pop only the top flow" intent.
    expect(getPopModalFlowTarget(buildRootState(2))).toBe(
      'right-modal-inner-key',
    );
  });

  it('returns undefined when the top root route is not a modal navigator', () => {
    const state: FakeState = {
      key: 'root-stack-key',
      index: 0,
      routes: [
        {
          name: NAVIGATORS.BOTTOM_TAB_NAVIGATOR,
          key: 'bottom-tab-key',
          state: {
            key: 'bottom-tab-inner-key',
            index: 0,
            routes: [{name: 'Home'}],
          },
        },
      ],
    };

    expect(getPopModalFlowTarget(state as State)).toBeUndefined();
  });

  it('returns undefined when the modal navigator has no inner state', () => {
    const state: FakeState = {
      key: 'root-stack-key',
      index: 1,
      routes: [
        {name: NAVIGATORS.BOTTOM_TAB_NAVIGATOR, key: 'bottom-tab-key'},
        {name: NAVIGATORS.RIGHT_MODAL_NAVIGATOR, key: 'right-modal-key'},
      ],
    };

    expect(getPopModalFlowTarget(state as State)).toBeUndefined();
  });
});
