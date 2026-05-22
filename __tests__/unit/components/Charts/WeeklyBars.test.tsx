/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {render} from '@testing-library/react-native';
import WeeklyBars from '@components/Charts/WeeklyBars/WeeklyBars';

// Stub the rendering layer — Skia + Victory don't initialize under Jest.
// Keep BaseChart's empty-state branch live by passing the children through.
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
        intensityRamp: ['', '', '', '', ''],
      },
    });
    return null;
  },
  Bar: () => null,
  Line: () => null,
  Area: () => null,
}));

jest.mock('@shopify/react-native-skia', () => ({
  __esModule: true,
  Rect: () => null,
}));

describe('WeeklyBars', () => {
  it('renders the emptyLabel when bars are empty', () => {
    const tree = render(
      <WeeklyBars
        bars={[]}
        band={{p25: 0, p75: 0}}
        accessibilityLabel="weekly bars"
        emptyLabel="Nothing logged yet"
      />,
    ).toJSON();
    expect(JSON.stringify(tree)).toContain('Nothing logged yet');
  });

  it('does not render the emptyLabel when bars are present', () => {
    const tree = render(
      <WeeklyBars
        bars={[
          {
            userId: 'u',
            isoYear: 2024,
            isoWeek: 8,
            weekStartDate: '2024-02-19',
            totalSdu: 4,
            drinksCount: 4,
            alcoholFreeDays: 5,
          },
        ]}
        band={{p25: 1, p75: 3}}
        accessibilityLabel="weekly bars"
        emptyLabel="Nothing logged yet"
      />,
    ).toJSON();
    expect(JSON.stringify(tree)).not.toContain('Nothing logged yet');
  });
});
