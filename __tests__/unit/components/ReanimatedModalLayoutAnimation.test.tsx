/* eslint-disable @typescript-eslint/naming-convention -- jest module-factory keys (__esModule) are Node-module shape, not our convention */
import {render} from '@testing-library/react-native';
import React from 'react';
import type {ValueOf} from 'type-fest';
import Backdrop from '@components/Modal/ReanimatedModal/Backdrop';
import Container from '@components/Modal/ReanimatedModal/Container';
import type {
  AnimationIn,
  AnimationOut,
} from '@components/Modal/ReanimatedModal/types';
import CONST from '@src/CONST';

// Reanimated emits a dev warning when a view that carries a layout-animation
// prop (entering/exiting/layout) ALSO sets a property the animation animates
// (here: opacity / transform) in its own style — the layout animation can
// overwrite that style. This warning is native-runtime-only (the check is
// skipped under IS_WEB and is not exercised by the reanimated jest mock), so we
// can't assert on the warning itself. Instead we assert the structural
// invariant that prevents it: capture the props handed to every Animated.View
// and verify no layout-animated view also sets opacity/transform.
//
// This fails on the pre-split implementation (single Animated.View carrying
// both `exiting` and the animated opacity/transform) and passes once the
// layout animation lives on an outer wrapper and the animated style on the
// inner view.
const mockCapturedAnimatedViewProps: Array<Record<string, unknown>> = [];

// A self-contained Reanimated mock: just enough surface for Container/Backdrop
// (+ utils' Easing). We deliberately do NOT requireActual the real mock — it
// transitively loads react-native-worklets' native module, which can't init
// under jest. `Animated.View` is a recording component so we can inspect the
// exact props (style + layout-animation) each view receives.
jest.mock('react-native-reanimated', () => {
  // NOTE: keep `as` casts on function types out of this factory — jest's
  // hoisting validator scans cast type expressions and rejects their parameter
  // names. Plain parameter type annotations (below) are fine.
  const ReactLocal = require('react') as typeof React;
  const {View} = require('react-native') as {
    View: React.ComponentType<Record<string, unknown>>;
  };
  const RecordingView = ReactLocal.forwardRef<unknown, Record<string, unknown>>(
    (props, ref) => {
      mockCapturedAnimatedViewProps.push(props);
      // Drop the layout-animation props before handing off to a plain View so RN
      // doesn't choke on unknown props; we've already recorded them above.
      const {entering, exiting, layout, ...rest} = props;
      return ReactLocal.createElement(View, {...rest, ref});
    },
  );

  const makeSharedValue = (initial: unknown) => {
    // Container/Backdrop only ever .set() a resolved value (withTiming returns
    // its target under the mock), so a plain assignment is sufficient.
    let current = initial;
    return {
      get: () => current,
      set: (next: unknown) => {
        current = next;
      },
    };
  };

  // Chainable Keyframe stub; truthy so it reads as a layout animation.
  class Keyframe {
    duration() {
      return this;
    }

    delay() {
      return this;
    }

    withCallback() {
      return this;
    }

    reduceMotion() {
      return this;
    }

    build() {
      return () => ({initialValues: {}, animations: {}});
    }
  }

  return {
    __esModule: true,
    default: {
      View: RecordingView,
      createAnimatedComponent: (c: unknown) => c,
    },
    View: RecordingView,
    Keyframe,
    ReduceMotion: {System: 'system', Never: 'never', Always: 'always'},
    // useAnimatedStyle invokes its worklet immediately and returns the style.
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: makeSharedValue,
    // withTiming runs its completion callback synchronously and resolves to the
    // target value, mirroring the official reanimated mock.
    withTiming: (
      toValue: unknown,
      _config: unknown,
      callback?: (finished: boolean) => void,
    ) => {
      callback?.(true);
      return toValue;
    },
    Easing: {bezier: () => ({factory: () => () => 0})},
  };
});

// Container's open-animation completion callback calls scheduleOnRN; stub it to
// invoke synchronously so nothing reaches the (uninitialised) native runtime.
jest.mock('react-native-worklets', () => ({
  __esModule: true,
  scheduleOnRN: (fn?: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    fn?.(...args),
}));

jest.mock('@hooks/useThemeStyles', () => ({
  __esModule: true,
  // Only the keys these two components read, with their real static values.
  default: () => ({
    flex1: {flex: 1},
    modalAnimatedContainer: {width: '100%'},
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'black',
    },
  }),
}));

jest.mock('@hooks/useLocalize', () => ({
  __esModule: true,
  default: () => ({translate: () => 'backdrop'}),
}));

// GestureHandler pulls in gesture-handler + worklets; for layout assertions we
// only need it to render its children.
jest.mock('@components/Modal/ReanimatedModal/Container/GestureHandler', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('@components/Pressable', () => {
  const ReactLocal = require('react') as typeof React;
  return {
    __esModule: true,
    PressableWithoutFeedback: ({children}: {children: React.ReactNode}) =>
      ReactLocal.createElement(ReactLocal.Fragment, null, children),
  };
});

function flattenStyle(style: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const visit = (value: unknown) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      Object.assign(out, value);
    }
  };
  visit(style);
  return out;
}

function isLayoutAnimated(props: Record<string, unknown>): boolean {
  return Boolean(props.entering ?? props.exiting ?? props.layout);
}

// Properties Reanimated's modal layout animations animate (fade -> opacity,
// slide -> transform); a layout-animated view must not also set these.
const CONFLICTING_PROPERTIES = ['opacity', 'transform'] as const;

function expectNoLayoutAnimatedViewSetsConflictingStyle() {
  const layoutAnimatedViews =
    mockCapturedAnimatedViewProps.filter(isLayoutAnimated);
  // Guard against a vacuous pass (e.g. the component stopped using a layout
  // animation entirely): there must be at least one to check.
  expect(layoutAnimatedViews.length).toBeGreaterThan(0);
  layoutAnimatedViews.forEach(props => {
    const flat = flattenStyle(props.style);
    CONFLICTING_PROPERTIES.forEach(property => {
      expect(flat).not.toHaveProperty(property);
    });
  });
}

type ContainerScenario = {
  name: string;
  type: ValueOf<typeof CONST.MODAL.MODAL_TYPE>;
  animationIn: AnimationIn;
  animationOut: AnimationOut;
};

const CONTAINER_SCENARIOS: ContainerScenario[] = [
  {
    name: 'RIGHT_DOCKED (slide -> transform)',
    type: CONST.MODAL.MODAL_TYPE.RIGHT_DOCKED,
    animationIn: 'slideInRight',
    animationOut: 'slideOutRight',
  },
  {
    name: 'BOTTOM_DOCKED (slide -> transform)',
    type: CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED,
    animationIn: 'slideInUp',
    animationOut: 'slideOutDown',
  },
  {
    name: 'CONFIRM (fade -> opacity)',
    type: CONST.MODAL.MODAL_TYPE.CONFIRM,
    animationIn: 'fadeIn',
    animationOut: 'fadeOut',
  },
  {
    name: 'CENTERED_SMALL (fade -> opacity)',
    type: CONST.MODAL.MODAL_TYPE.CENTERED_SMALL,
    animationIn: 'fadeIn',
    animationOut: 'fadeOut',
  },
];

describe('ReanimatedModal layout-animation / style separation', () => {
  beforeEach(() => {
    mockCapturedAnimatedViewProps.length = 0;
  });

  describe('Container', () => {
    test.each(CONTAINER_SCENARIOS)(
      '$name: the exiting layout animation is not on a view that also sets opacity/transform',
      ({type, animationIn, animationOut}) => {
        render(
          <Container
            onOpenCallBack={jest.fn()}
            onCloseCallBack={jest.fn()}
            animationIn={animationIn}
            animationOut={animationOut}
            type={type}
          />,
        );

        expectNoLayoutAnimatedViewSetsConflictingStyle();
      },
    );
  });

  describe('Backdrop', () => {
    test('the exiting fade animation is not on a view that also sets opacity', () => {
      render(
        <Backdrop
          style={{width: 100, height: 100, backgroundColor: 'black'}}
          isBackdropVisible
          animationInTiming={300}
          animationOutTiming={300}
          backdropOpacity={0.7}
        />,
      );

      expectNoLayoutAnimatedViewSetsConflictingStyle();
    });
  });
});
