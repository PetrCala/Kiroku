/* eslint-disable @typescript-eslint/naming-convention -- jest module-factory keys (__esModule) are Node-module shape, not our convention */

import {render} from '@testing-library/react-native';
import React from 'react';
import type {ViewStyle} from 'react-native';
import Skeleton from '@components/Skeleton';

jest.mock('@hooks/useTheme', () => ({
  __esModule: true,
  default: () => ({
    skeletonBase: '#262d36',
    skeletonHighlight: '#3d444d',
  }),
}));

// Stub the animation engine so the unit test exercises Skeleton's box/prop
// logic without rendering the react-content-loader SVG (which isn't transformed
// under jest). The stub surfaces the `animate` flag it receives for assertion.
jest.mock('@components/SkeletonViewContentLoader', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: ({animate}: {animate?: boolean}) => (
      <View testID="skeleton-loader" animate={animate} />
    ),
  };
});

type Json = {
  props?: Record<string, unknown>;
  children?: Json[] | null;
} | null;

function flattenStyle(style: unknown): ViewStyle {
  return ([] as unknown[])
    .concat(style ?? [])
    .filter(Boolean)
    .reduce<ViewStyle>((acc, s) => ({...acc, ...(s as ViewStyle)}), {});
}

function findByTestId(node: Json, testID: string): Json {
  if (!node) {
    return null;
  }
  if (node.props?.testID === testID) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = findByTestId(child, testID);
    if (found) {
      return found;
    }
  }
  return null;
}

describe('Skeleton', () => {
  test('renders without throwing', () => {
    const {toJSON} = render(<Skeleton width={100} height={20} />);
    expect(toJSON()).not.toBeNull();
  });

  test('applies explicit width and height to the container', () => {
    const {toJSON} = render(<Skeleton width={120} height={40} />);
    const style = flattenStyle((toJSON() as Json)?.props?.style);
    expect(style.width).toBe(120);
    expect(style.height).toBe(40);
  });

  test('defaults width to fill the parent', () => {
    const {toJSON} = render(<Skeleton height={40} />);
    expect(flattenStyle((toJSON() as Json)?.props?.style).width).toBe('100%');
  });

  test('circle forces a square box', () => {
    const {toJSON} = render(<Skeleton circle height={50} />);
    const style = flattenStyle((toJSON() as Json)?.props?.style);
    expect(style.width).toBe(50);
    expect(style.height).toBe(50);
  });

  test('animates by default and forwards animate={false}', () => {
    const animated = findByTestId(
      render(<Skeleton height={10} />).toJSON() as Json,
      'skeleton-loader',
    );
    expect(animated?.props?.animate).toBe(true);

    const still = findByTestId(
      render(<Skeleton height={10} animate={false} />).toJSON() as Json,
      'skeleton-loader',
    );
    expect(still?.props?.animate).toBe(false);
  });

  test('is decorative unless given an accessibilityLabel', () => {
    const plain = render(<Skeleton height={10} />).toJSON() as Json;
    expect(plain?.props?.accessibilityRole).toBeUndefined();

    const labelled = render(
      <Skeleton height={10} accessibilityLabel="Loading" />,
    ).toJSON() as Json;
    expect(labelled?.props?.accessibilityRole).toBe('progressbar');
    expect(labelled?.props?.accessibilityLabel).toBe('Loading');
  });
});
