/* eslint-disable @typescript-eslint/naming-convention -- jest module-factory keys (__esModule) are Node-module shape, not our convention */

import React from 'react';
import type {ViewStyle} from 'react-native';
import {render} from '@testing-library/react-native';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';

function flattenStyle(style: unknown): ViewStyle {
  return ([] as unknown[])
    .concat(style ?? [])
    .filter(Boolean)
    .reduce<ViewStyle>((acc, s) => ({...acc, ...(s as ViewStyle)}), {});
}

jest.mock('@hooks/useTheme', () => ({
  __esModule: true,
  default: () => ({
    borderLighter: '#eeeeee',
    highlightBG: '#f7f7f7',
    skeletonBase: '#262d36',
    skeletonHighlight: '#3d444d',
  }),
}));

jest.mock('@hooks/useResponsiveLayout', () => ({
  __esModule: true,
  default: () => ({shouldUseNarrowLayout: false}),
}));

// Stub the animation engine so variants built on the Skeleton primitive render
// without the react-content-loader SVG (not transformed under jest).
jest.mock('@components/SkeletonViewContentLoader', () => {
  const {View} = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: () => <View testID="skeleton-loader" />,
  };
});

describe('ChartSkeleton', () => {
  const VARIANTS = [
    'card',
    'bars',
    'line',
    'calendar',
    'kpiRow',
    'kpi',
    'polar',
    'donut',
    'grid',
    'heatmapWeekHour',
  ] as const;

  test.each(VARIANTS)('renders %s variant without throwing', variant => {
    const {toJSON} = render(
      <ChartSkeleton variant={variant} accessibilityLabel="Loading chart" />,
    );

    expect(toJSON()).not.toBeNull();
  });

  test('respects explicit height for card variant', () => {
    const {toJSON} = render(
      <ChartSkeleton
        variant="card"
        height={321}
        accessibilityLabel="Loading thing"
      />,
    );

    const tree = toJSON() as {
      props: {style?: ViewStyle | ViewStyle[]};
    } | null;
    expect(tree).not.toBeNull();
    expect(flattenStyle(tree?.props.style).height).toBe(321);
  });
});
