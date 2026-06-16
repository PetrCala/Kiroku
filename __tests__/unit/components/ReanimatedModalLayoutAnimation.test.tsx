/* eslint-disable @typescript-eslint/naming-convention -- jest module-factory keys (__esModule) are Node-module shape, not our convention */
import {render} from '@testing-library/react-native';
import React from 'react';
import type {LayoutChangeEvent} from 'react-native';
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

// Container seeds the content-sized slide distance from the window size; a fixed
// window keeps the off-screen start deterministic for the assertions below.
const MOCK_WINDOW_HEIGHT = 800;
jest.mock('@hooks/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    windowHeight: 800,
    windowWidth: 400,
  }),
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

    // The reveal opacity lives on the inner (non-layout-animated) Animated.View;
    // its first-frame value is what either covers the window or leaves it
    // exposed (#813).
    function getRevealOpacity() {
      const revealView = mockCapturedAnimatedViewProps.find(
        props =>
          !isLayoutAnimated(props) && 'opacity' in flattenStyle(props.style),
      );
      return flattenStyle(revealView?.style).opacity;
    }

    test('fades in from transparent by default (first frame opacity 0)', () => {
      render(
        <Backdrop
          style={{width: 100, height: 100, backgroundColor: 'black'}}
          isBackdropVisible
          animationInTiming={300}
          animationOutTiming={300}
          backdropOpacity={0.7}
        />,
      );

      expect(getRevealOpacity()).toBe(0);
    });

    test('shouldShowImmediately covers on the first frame (opacity 1, no fade)', () => {
      render(
        <Backdrop
          style={{width: 100, height: 100, backgroundColor: 'black'}}
          isBackdropVisible
          shouldShowImmediately
          animationInTiming={300}
          animationOutTiming={300}
          backdropOpacity={0.7}
        />,
      );

      // Full strength on frame 1 so the native iOS modal window never shows
      // through the dim's first frame as a brightening flash.
      expect(getRevealOpacity()).toBe(1);
    });
  });

  // BOTTOM_DOCKED is the only slide type whose animated sheet is content-sized,
  // so its `translateY: 100%` can't resolve before the first paint on the New
  // Architecture and the sheet flashes at its docked position for one frame
  // (#813). The fix translates by a concrete pixel distance (the window size,
  // refined to the measured sheet height) and starts on mount, so the sheet is
  // always off-screen on the first frame and always slides in — it can neither
  // flash at its final state nor get stuck hidden. The other types are
  // unchanged.
  describe('Container open reveal (#813 slide-up flicker)', () => {
    // The inner content view is the only Animated.View wired with the
    // slide-measurement onLayout; the wrappers carry the layout animation.
    function getContentViewProps() {
      return mockCapturedAnimatedViewProps.find(
        props => typeof props.onLayout === 'function',
      );
    }

    function getTranslateY(style: unknown): unknown {
      const {transform} = flattenStyle(style);
      if (!Array.isArray(transform)) {
        return undefined;
      }
      const entries = transform as Array<Record<string, unknown>>;
      const entry = entries.find(item => 'translateY' in item);
      return entry ? entry.translateY : undefined;
    }

    function fireLayout(
      props: Record<string, unknown> | undefined,
      height: number,
      width: number,
    ) {
      (props?.onLayout as (event: LayoutChangeEvent) => void)({
        nativeEvent: {layout: {height, width, x: 0, y: 0}},
      } as LayoutChangeEvent);
    }

    test('BOTTOM_DOCKED first frame is a concrete off-screen pixel translate (no flash, never hidden)', () => {
      render(
        <Container
          onOpenCallBack={jest.fn()}
          onCloseCallBack={jest.fn()}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          type={CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED}
        />,
      );

      const content = getContentViewProps();
      expect(content).toBeDefined();
      // Starts a full window height below its docked rest: a concrete number
      // (not a layout-dependent percentage that resolves to 0 = the flash), and
      // never opacity 0 (the "modal never shows" regression).
      expect(getTranslateY(content?.style)).toBe(MOCK_WINDOW_HEIGHT);
      expect(flattenStyle(content?.style)).not.toHaveProperty('opacity');
    });

    test('BOTTOM_DOCKED starts the open animation on mount so it can never get stuck hidden', () => {
      const onOpenCallBack = jest.fn();
      render(
        <Container
          onOpenCallBack={onOpenCallBack}
          onCloseCallBack={jest.fn()}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          type={CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED}
        />,
      );

      // The slide runs without waiting for a layout callback (withTiming
      // resolves synchronously under the mock, firing the completion callback).
      expect(onOpenCallBack).toHaveBeenCalledTimes(1);
      // It still wires the measure hook to refine the travel to the sheet height.
      expect(typeof getContentViewProps()?.onLayout).toBe('function');
    });

    test('BOTTOM_DOCKED onLayout refines the travel without restarting the animation', () => {
      const onOpenCallBack = jest.fn();
      render(
        <Container
          onOpenCallBack={onOpenCallBack}
          onCloseCallBack={jest.fn()}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          type={CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED}
        />,
      );

      const content = getContentViewProps();
      // Refinement is a no-op for the open callback; later re-layouts are
      // ignored, so neither fires (or restarts) the open animation again.
      expect(() => fireLayout(content, 250, 400)).not.toThrow();
      fireLayout(content, 300, 400);
      expect(onOpenCallBack).toHaveBeenCalledTimes(1);
    });

    test.each([
      {
        name: 'CONFIRM (fade)',
        type: CONST.MODAL.MODAL_TYPE.CONFIRM,
        animationIn: 'fadeIn' as const,
        animationOut: 'fadeOut' as const,
      },
      {
        name: 'CENTERED_SMALL (fade)',
        type: CONST.MODAL.MODAL_TYPE.CENTERED_SMALL,
        animationIn: 'fadeIn' as const,
        animationOut: 'fadeOut' as const,
      },
      {
        name: 'RIGHT_DOCKED (fill slide, percentage resolves immediately)',
        type: CONST.MODAL.MODAL_TYPE.RIGHT_DOCKED,
        animationIn: 'slideInRight' as const,
        animationOut: 'slideOutRight' as const,
      },
    ])(
      '$name starts the open animation on mount and skips the measurement hook',
      ({type, animationIn, animationOut}) => {
        const onOpenCallBack = jest.fn();
        render(
          <Container
            onOpenCallBack={onOpenCallBack}
            onCloseCallBack={jest.fn()}
            animationIn={animationIn}
            animationOut={animationOut}
            type={type}
          />,
        );

        expect(onOpenCallBack).toHaveBeenCalledTimes(1);
        // No content-sized slide measurement, so no onLayout reveal hook.
        expect(getContentViewProps()).toBeUndefined();
      },
    );
  });
});
