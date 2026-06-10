/* eslint-disable @typescript-eslint/naming-convention -- jest module-factory keys (__esModule) are Node-module shape, not our convention */
import {render} from '@testing-library/react-native';
import React from 'react';
import AnimatedKirokuLogoSvg from '@components/KirokuLogo/AnimatedKirokuLogoSvg';
import KirokuLogoSvg from '@components/KirokuLogo/KirokuLogoSvg';
import {LOGO_SHAPES} from '@components/KirokuLogo/logoShapes';
import CONST from '@src/CONST';

// A self-contained Reanimated mock: just enough surface for the animated logo
// (+ animationTimings' Easing composition). We deliberately do NOT
// requireActual the real mock — it transitively loads react-native-worklets'
// native module, which can't init under jest (same approach as
// ReanimatedModalLayoutAnimation.test.tsx).
jest.mock('react-native-reanimated', () => {
  const ReactLocal = require('react') as typeof React;
  const {View} = require('react-native') as {
    View: React.ComponentType<Record<string, unknown>>;
  };
  const PassthroughView = ReactLocal.forwardRef<
    unknown,
    Record<string, unknown>
  >((props, ref) => ReactLocal.createElement(View, {...props, ref}));

  return {
    __esModule: true,
    default: {
      View: PassthroughView,
      createAnimatedComponent: (c: unknown) => c,
    },
    View: PassthroughView,
    // useAnimatedStyle invokes its worklet immediately and returns the style.
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (initial: unknown) => ({value: initial}),
    // withTiming resolves to the target value, mirroring the official mock.
    withTiming: (toValue: unknown) => toValue,
    cancelAnimation: () => {},
    useReducedMotion: () => false,
    interpolate: (
      value: number,
      [inMin, inMax]: number[],
      [outMin, outMax]: number[],
    ) => {
      const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
      return outMin + t * (outMax - outMin);
    },
    Extrapolation: {CLAMP: 'clamp'},
    Easing: {
      linear: (t: number) => t,
      quad: (t: number) => t * t,
      back: () => (t: number) => t,
      out: (fn: (t: number) => number) => (t: number) => 1 - fn(1 - t),
    },
  };
});

// The mark's six shapes. The stem and baseline entries are the axis-aligned
// path conversions of the rotated <rect>s in the master art — this literal
// copy locks the conversion (see logoShapes.ts for the derivation).
const EXPECTED_SHAPES = [
  'M636.5 348L512.66 134L389 348H636.5Z',
  'M388.5 434L512.34 648L636 434L388.5 434Z',
  'M503 618H523V803H503Z',
  'M129 808L316 480L374 580L243.117 808H129Z',
  'M895.5 808L708.5 480L650.5 580L781.383 808H895.5Z',
  'M422 798H602V808H422Z',
];

type RenderedNode = {
  props?: Record<string, unknown>;
  children?: Array<RenderedNode | string> | null;
};

/** Collects every value of the given prop in the rendered JSON tree */
function collectProp(node: RenderedNode | null, prop: string): unknown[] {
  if (!node) {
    return [];
  }
  const own = node.props && prop in node.props ? [node.props[prop]] : [];
  const fromChildren = (node.children ?? []).flatMap(child =>
    typeof child === 'string' ? [] : collectProp(child, prop),
  );
  return [...own, ...fromChildren];
}

describe('logoShapes', () => {
  it('matches the master art geometry (incl. rect→path conversions)', () => {
    expect(LOGO_SHAPES).toEqual(EXPECTED_SHAPES);
  });
});

describe('KirokuLogoSvg', () => {
  it('renders exactly the six logo shapes on production (no badge)', () => {
    const {toJSON} = render(
      <KirokuLogoSvg fill="#000000" environment={CONST.ENVIRONMENT.PROD} />,
    );
    const tree = toJSON() as RenderedNode;
    expect(collectProp(tree, 'd')).toEqual(EXPECTED_SHAPES);
    // SVG text renders its string into the tspan `content` prop, so badge
    // presence is asserted on props rather than via text queries.
    expect(collectProp(tree, 'content')).not.toContain('DEV');
  });

  it('renders the environment badge on development', () => {
    const {toJSON} = render(
      <KirokuLogoSvg fill="#000000" environment={CONST.ENVIRONMENT.DEV} />,
    );
    expect(collectProp(toJSON() as RenderedNode, 'content')).toContain('DEV');
  });
});

describe('AnimatedKirokuLogoSvg', () => {
  it('renders all six shapes without throwing when started', () => {
    const {toJSON} = render(
      <AnimatedKirokuLogoSvg
        fill="#000000"
        environment={CONST.ENVIRONMENT.PROD}
        shouldStart
      />,
    );
    expect(collectProp(toJSON() as RenderedNode, 'd')).toEqual(EXPECTED_SHAPES);
  });

  it('renders while armed (shouldStart false) without throwing', () => {
    const {toJSON} = render(
      <AnimatedKirokuLogoSvg
        fill="#000000"
        environment={CONST.ENVIRONMENT.DEV}
        shouldStart={false}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
