/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {render} from '@testing-library/react-native';
import {MiniTrendLine} from '@components/Charts/MiniTrendLine';

jest.mock('@components/Charts/BaseChart', () => ({
  __esModule: true,
  BaseChart: ({
    data,
    emptyLabel,
    children,
  }: {
    data: unknown[];
    emptyLabel?: string;
    children?: (ctx: unknown) => unknown;
  }) => {
    if (data.length === 0 && emptyLabel) {
      const ReactInner =
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        require('react') as typeof import('react');
      const RNm =
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        require('react-native') as typeof import('react-native');
      return ReactInner.createElement(RNm.Text, null, emptyLabel);
    }
    children?.({
      points: {y: []},
      chartBounds: {left: 0, top: 0, right: 100, bottom: 100},
      theme: {
        bandFill: '#000',
        primaryFill: '#fff',
        primaryStroke: '#fff',
        intensityRamp: ['', '', '', '', ''],
      },
    });
    return null;
  },
  Line: () => null,
  Area: () => null,
}));

jest.mock('@shopify/react-native-skia', () => ({
  __esModule: true,
  Rect: () => null,
}));

describe('MiniTrendLine', () => {
  it('renders the emptyLabel when points are empty', () => {
    const tree = render(
      <MiniTrendLine
        points={[]}
        band={{p25: 0, p75: 0}}
        accessibilityLabel="trend"
        emptyLabel="Nothing logged yet"
      />,
    ).toJSON();
    expect(JSON.stringify(tree)).toContain('Nothing logged yet');
  });

  it('renders without throwing when points and band are present', () => {
    const points = [
      {x: '2026-W19', y: 1},
      {x: '2026-W20', y: 2},
      {x: '2026-W21', y: 3},
    ];
    expect(() =>
      render(
        <MiniTrendLine
          points={points}
          band={{p25: 1, p75: 2.5}}
          ewma={[1, 1.5, 2.0]}
          accessibilityLabel="trend"
        />,
      ),
    ).not.toThrow();
  });

  it('falls back to raw points when ewma length mismatches', () => {
    const points = [
      {x: 'a', y: 1},
      {x: 'b', y: 2},
    ];
    expect(() =>
      render(
        <MiniTrendLine
          points={points}
          band={{p25: 0, p75: 0}}
          ewma={[5]}
          accessibilityLabel="trend"
        />,
      ),
    ).not.toThrow();
  });
});
