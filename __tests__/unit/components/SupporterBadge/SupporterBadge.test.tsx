/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {render} from '@testing-library/react-native';
import SupporterBadge from '@components/SupporterBadge';

jest.mock('@hooks/useLocalize', () => ({
  __esModule: true,
  default: () => ({
    translate: (key: string) =>
      key === 'supporter.badgeAccessibilityLabel' ? 'Kiroku Supporter' : key,
  }),
}));

jest.mock('@hooks/useTheme', () => ({
  __esModule: true,
  default: () => ({appColor: '#F5C400'}),
}));

// Mock the icon set so the test doesn't pull the real SVG asset chain.
jest.mock('@components/Icon/KirokuIcons', () => ({
  __esModule: true,
  Beer: 'Beer',
}));

// Stub the Icon component to a host View that echoes its size props, so we can
// assert the badge renders an icon and scales by variant without loading the
// real (ESM) Icon dependencies.
jest.mock('@components/Icon', () => {
  const ReactModule = require('react') as typeof import('react');
  const {View} = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({width, height}: {width?: number; height?: number}) =>
      ReactModule.createElement(View, {
        testID: 'supporter-badge-icon',
        width,
        height,
      }),
  };
});

type RenderedNode = {
  props?: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    width?: number;
  };
  children?: RenderedNode[] | null;
};

function findIconWidth(node: RenderedNode | null): number | undefined {
  if (!node) {
    return undefined;
  }
  if (typeof node.props?.width === 'number') {
    return node.props.width;
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
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
    expect(JSON.stringify(tree)).toContain('supporter-badge-icon');
  });

  it('exposes the localized accessibility label and image role', () => {
    const tree = render(
      <SupporterBadge isSupporter />,
    ).toJSON() as RenderedNode;
    expect(tree.props?.accessibilityLabel).toBe('Kiroku Supporter');
    expect(tree.props?.accessibilityRole).toBe('image');
  });

  it('uses a smaller icon for the small variant', () => {
    const small = render(
      <SupporterBadge isSupporter size="small" />,
    ).toJSON() as RenderedNode;
    const medium = render(
      <SupporterBadge isSupporter size="medium" />,
    ).toJSON() as RenderedNode;
    const smallSize = findIconWidth(small) ?? 0;
    const mediumSize = findIconWidth(medium) ?? 0;
    expect(smallSize).toBeGreaterThan(0);
    expect(mediumSize).toBeGreaterThan(0);
    expect(smallSize).toBeLessThan(mediumSize);
  });
});
