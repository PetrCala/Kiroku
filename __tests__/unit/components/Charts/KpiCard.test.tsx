/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {render} from '@testing-library/react-native';
import KpiCard from '@components/Charts/KpiCard/KpiCard';

// Mock the whole Pressable barrel. PressableWithFeedback pulls in Reanimated
// → Worklets → native modules that don't initialize under Jest. Replacing
// it with a passthrough lets KpiCard render in tests.
jest.mock('@components/Pressable', () => {
  // `typeof import(...)` is the only way to type these inside a hoisted
  // jest factory — top-level type imports are unreachable here.
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const ReactM = jest.requireActual<typeof import('react')>('react');
  const RNm =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    PressableWithFeedback: ({children}: {children: React.ReactNode}) =>
      ReactM.createElement(RNm.View, null, children),
  };
});

// Sparkline composes BaseChart → CartesianChart → Skia. Stub it.
jest.mock('@components/Charts/Sparkline', () => ({
  __esModule: true,
  Sparkline: () => null,
}));

describe('KpiCard', () => {
  it('renders the label, value, and unit', () => {
    const tree = render(
      <KpiCard label="Alcohol-free days" value={12} unit="days" />,
    ).toJSON();
    const json = JSON.stringify(tree);
    expect(json).toContain('Alcohol-free days');
    expect(json).toContain('12');
    expect(json).toContain('days');
  });

  it('renders a delta chip when delta is provided', () => {
    const tree = render(
      <KpiCard
        label="Total units"
        value={4}
        delta={{value: -2, direction: 'down', label: 'vs last week'}}
      />,
    ).toJSON();
    const json = JSON.stringify(tree);
    expect(json).toContain('▼');
    expect(json).toContain('2');
    expect(json).toContain('vs last week');
  });

  it('skips the delta chip when delta is absent', () => {
    const tree = render(<KpiCard label="x" value={1} />).toJSON();
    const json = JSON.stringify(tree);
    expect(json).not.toContain('▼');
    expect(json).not.toContain('▲');
  });
});
