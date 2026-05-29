import {render} from '@testing-library/react-native';
import BarList from '@components/Charts/BarList/BarList';

describe('BarList', () => {
  it('renders a label and value for every item, including zero', () => {
    const json = JSON.stringify(
      render(
        <BarList
          accessibilityLabel="Units per week"
          items={[
            {label: 'W1', value: 12},
            {label: 'W2', value: 0},
            {label: 'W3', value: 5},
          ]}
        />,
      ).toJSON(),
    );
    expect(json).toContain('W1');
    expect(json).toContain('W2');
    expect(json).toContain('W3');
    expect(json).toContain('12');
    // The zero row still renders its value.
    expect(json).toContain('0');
  });

  it('renders without crashing on an empty list', () => {
    const tree = render(
      <BarList accessibilityLabel="empty" items={[]} />,
    ).toJSON();
    expect(tree).not.toBeNull();
  });
});
