import {render} from '@testing-library/react-native';
import DistributionBar from '@components/Charts/DistributionBar/DistributionBar';

const SEGMENTS = [
  {label: 'AF', value: 20, color: '#0a0'},
  {label: 'Light', value: 6, color: '#ff0'},
  {label: 'Moderate', value: 3, color: '#f80'},
  {label: 'Heavy', value: 1, color: '#f00'},
];

describe('DistributionBar', () => {
  it('renders the legend label and count for each band', () => {
    const json = JSON.stringify(
      render(
        <DistributionBar
          accessibilityLabel="Day distribution"
          segments={SEGMENTS}
        />,
      ).toJSON(),
    );
    expect(json).toContain('AF');
    expect(json).toContain('Heavy');
    expect(json).toContain('20');
  });

  it('renders without crashing when every band is zero', () => {
    const tree = render(
      <DistributionBar
        accessibilityLabel="empty"
        segments={SEGMENTS.map(s => ({...s, value: 0}))}
      />,
    ).toJSON();
    expect(tree).not.toBeNull();
  });
});
