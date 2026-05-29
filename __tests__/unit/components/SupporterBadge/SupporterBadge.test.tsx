/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {render} from '@testing-library/react-native';
import SupporterBadge from '@components/SupporterBadge';

const ICON_TEST_ID = 'supporter-badge-icon';

jest.mock('@hooks/useLocalize', () => ({
  __esModule: true,
  default: () => ({
    translate: (key: string) =>
      key === 'supporter.badgeAccessibilityLabel' ? 'Kiroku Supporter' : key,
  }),
}));

// Mock the icon set so the test doesn't pull the real SVG asset chain.
jest.mock('@components/Icon/KirokuIcons', () => ({
  __esModule: true,
  SupporterCoin: 'SupporterCoin',
}));

// Stub the Icon component to a Text node that echoes its width, so we can
// assert the badge renders an icon and scales by variant without loading the
// real (ESM) Icon dependencies.
jest.mock('@components/Icon', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const ReactInner = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const RNm = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({width}: {width?: number; height?: number}) =>
      ReactInner.createElement(
        RNm.Text,
        {testID: 'supporter-badge-icon'},
        String(width ?? ''),
      ),
  };
});

type RenderedNode = {
  props?: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    testID?: string;
  };
  children?: unknown;
};

function findIconWidth(node: unknown): number | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const typed = node as RenderedNode;
  const kids = Array.isArray(typed.children) ? typed.children : [];
  if (typed.props?.testID === ICON_TEST_ID) {
    const value = Number(kids[0]);
    return Number.isNaN(value) ? undefined : value;
  }
  for (const child of kids) {
    const found = findIconWidth(child);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

describe('SupporterBadge', () => {
  it('renders nothing when isSupporter is false', () => {
    const tree = render(<SupporterBadge isSupporter={false} />).toJSON();
    expect(tree).toBeNull();
  });

  it('renders the supporter (beer) icon when isSupporter is true', () => {
    const tree = render(<SupporterBadge isSupporter />).toJSON();
    expect(JSON.stringify(tree)).toContain(ICON_TEST_ID);
  });

  it('exposes the localized accessibility label and image role', () => {
    const tree = render(
      <SupporterBadge isSupporter />,
    ).toJSON() as RenderedNode;
    expect(tree.props?.accessibilityLabel).toBe('Kiroku Supporter');
    expect(tree.props?.accessibilityRole).toBe('image');
  });

  it('uses a smaller icon for the small variant', () => {
    const small = render(<SupporterBadge isSupporter size="small" />).toJSON();
    const medium = render(
      <SupporterBadge isSupporter size="medium" />,
    ).toJSON();
    const smallSize = findIconWidth(small) ?? 0;
    const mediumSize = findIconWidth(medium) ?? 0;
    expect(smallSize).toBeGreaterThan(0);
    expect(mediumSize).toBeGreaterThan(0);
    expect(smallSize).toBeLessThan(mediumSize);
  });
});
