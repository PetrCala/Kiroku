/* eslint-disable @typescript-eslint/naming-convention -- jest module-factory keys (__esModule) are Node-module shape, not our convention */

import React from 'react';
import {render} from '@testing-library/react-native';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';

jest.mock('@hooks/useTheme', () => ({
  __esModule: true,
  default: () => ({
    borderLighter: '#eeeeee',
    highlightBG: '#f7f7f7',
  }),
}));

jest.mock('@hooks/useResponsiveLayout', () => ({
  __esModule: true,
  default: () => ({shouldUseNarrowLayout: false}),
}));

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

    const tree = toJSON() as {props: {style?: {height?: number}}} | null;
    expect(tree).not.toBeNull();
    expect(tree?.props.style?.height).toBe(321);
  });
});
