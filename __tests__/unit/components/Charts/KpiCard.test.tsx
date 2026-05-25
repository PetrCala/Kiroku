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

  describe('polarity', () => {
    // Pull the inline `color` from the delta-chip Text node (the one whose
    // first child contains the up/down/flat arrow). Returns undefined when no
    // delta chip is present.
    function findDeltaColor(node: unknown): string | undefined {
      if (!node || typeof node !== 'object') {
        return undefined;
      }
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = findDeltaColor(child);
          if (found) {
            return found;
          }
        }
        return undefined;
      }
      const tree = node as {
        type?: string;
        props?: {style?: unknown};
        children?: unknown;
      };
      const children = tree.children;
      if (
        tree.type === 'Text' &&
        Array.isArray(children) &&
        children.some(c => typeof c === 'string' && /[▲▼–]/.test(c))
      ) {
        const styleProp = tree.props?.style;
        const styles = Array.isArray(styleProp)
          ? (styleProp as unknown[]).flat(Infinity)
          : [styleProp];
        for (const entry of styles) {
          if (entry && typeof entry === 'object' && 'color' in entry) {
            return (entry as {color: string}).color;
          }
        }
      }
      return findDeltaColor(children);
    }

    function deltaColorFor(
      direction: 'up' | 'down' | 'flat',
      polarity?: 'lower-is-supportive' | 'higher-is-supportive' | 'neutral',
    ): string | undefined {
      const tree = render(
        <KpiCard
          label="x"
          value={1}
          delta={{value: 1, direction, label: 'vs last week'}}
          polarity={polarity}
        />,
      ).toJSON();
      return findDeltaColor(tree);
    }

    it('higher-is-supportive inverts the default color mapping', () => {
      // Same "supportive" color for default-down and flipped-up.
      expect(deltaColorFor('up', 'higher-is-supportive')).toBe(
        deltaColorFor('down'),
      );
      // Same "warning" color for default-up and flipped-down.
      expect(deltaColorFor('down', 'higher-is-supportive')).toBe(
        deltaColorFor('up'),
      );
    });

    it('neutral polarity uses the muted color for every direction', () => {
      const up = deltaColorFor('up', 'neutral');
      const down = deltaColorFor('down', 'neutral');
      expect(up).toBe(down);
      // ...and is distinct from the supportive color on the default mapping.
      expect(up).not.toBe(deltaColorFor('down'));
    });
  });
});
