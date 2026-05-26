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

describe('SupporterBadge', () => {
  it('renders nothing when isSupporter is false', () => {
    const tree = render(<SupporterBadge isSupporter={false} />).toJSON();
    expect(tree).toBeNull();
  });

  it('renders the supporter emoji when isSupporter is true', () => {
    const tree = render(<SupporterBadge isSupporter />).toJSON();
    const json = JSON.stringify(tree);
    expect(json).toContain('🍺');
  });

  it('exposes the localized accessibility label and image role', () => {
    const tree = render(<SupporterBadge isSupporter />).toJSON() as {
      props: {accessibilityLabel?: string; accessibilityRole?: string};
    };
    expect(tree.props.accessibilityLabel).toBe('Kiroku Supporter');
    expect(tree.props.accessibilityRole).toBe('image');
  });

  it('uses a smaller font size for the small variant', () => {
    const small = render(
      <SupporterBadge isSupporter size="small" />,
    ).toJSON() as {props: {style: Array<{fontSize?: number}>}} | null;
    const medium = render(
      <SupporterBadge isSupporter size="medium" />,
    ).toJSON() as {props: {style: Array<{fontSize?: number}>}} | null;

    function findFontSize(
      node: {props?: {style?: unknown}} | null,
    ): number | undefined {
      const styleProp = node?.props?.style;
      const styles = Array.isArray(styleProp)
        ? (styleProp as unknown[]).flat(Infinity)
        : [styleProp];
      for (const entry of styles) {
        if (entry && typeof entry === 'object' && 'fontSize' in entry) {
          return (entry as {fontSize: number}).fontSize;
        }
      }
      return undefined;
    }

    const smallSize = findFontSize(small) ?? 0;
    const mediumSize = findFontSize(medium) ?? 0;
    expect(smallSize).toBeGreaterThan(0);
    expect(mediumSize).toBeGreaterThan(0);
    expect(smallSize).toBeLessThan(mediumSize);
  });
});
