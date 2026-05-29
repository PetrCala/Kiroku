/* eslint-disable @typescript-eslint/naming-convention -- jest mock keys */
import {render} from '@testing-library/react-native';
import type {ReactNode} from 'react';
import BaseChart from '@components/Charts/BaseChart/BaseChart';
import type {ChartRenderCtx} from '@components/Charts/BaseChart/types';

// CartesianChart pulls Skia + Reanimated workers at import time, none of
// which run in Jest. Stub it to a passthrough so the render-prop path is
// exercisable without native modules.
type StubProps = {
  children?: (ctx: {
    points: {y: []};
    chartBounds: ChartRenderCtx['chartBounds'];
  }) => ReactNode;
};
jest.mock('victory-native', () => ({
  __esModule: true,
  CartesianChart: jest.fn(({children}: StubProps) =>
    children?.({
      points: {y: []},
      chartBounds: {left: 0, top: 0, right: 100, bottom: 100},
    }),
  ),
}));

// useThemeStyles returns a Proxy in production; under Jest it can leak
// `undefined` style refs that break testing-library's accessibility scan.
// Replace with a flat object — the styles aren't load-bearing here.
jest.mock('@hooks/useThemeStyles', () => ({
  __esModule: true,
  default: () =>
    new Proxy(
      {},
      {
        get: () => ({}),
      },
    ),
}));

describe('BaseChart', () => {
  it('renders the empty label when data is empty and emptyLabel is provided', () => {
    // Use toJSON() because testing-library's text queries traverse styles via
    // StyleSheet.flatten, which the project's react-native mock doesn't fully
    // surface in the empty-state path.
    const tree = render(
      <BaseChart
        data={[]}
        range="week"
        accessibilityLabel="weekly bars"
        emptyLabel="Nothing here yet"
      />,
    ).toJSON();
    expect(JSON.stringify(tree)).toContain('Nothing here yet');
  });

  it('does not render the empty state when data is non-empty', () => {
    const tree = render(
      <BaseChart
        data={[{x: 1, y: 2}]}
        range="week"
        accessibilityLabel="weekly bars"
        emptyLabel="Nothing here yet"
      />,
    ).toJSON();
    expect(JSON.stringify(tree)).not.toContain('Nothing here yet');
  });

  it('invokes children with a render context including a theme', () => {
    let captured: ChartRenderCtx | undefined;
    const children = (ctx: ChartRenderCtx) => {
      captured = ctx;
      return null;
    };
    render(
      <BaseChart
        data={[{x: 1, y: 2}]}
        range="week"
        accessibilityLabel="weekly bars">
        {children}
      </BaseChart>,
    );
    expect(captured).toBeDefined();
    expect(captured?.points).toBeDefined();
    expect(captured?.chartBounds).toBeDefined();
    expect(typeof captured?.theme.primaryFill).toBe('string');
    expect(captured?.theme.intensityRamp).toHaveLength(5);
  });
});
