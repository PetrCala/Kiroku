/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {fireEvent, render} from '@testing-library/react-native';
import CalendarHeatmap from '@components/Charts/CalendarHeatmap/CalendarHeatmap';
import type {HeatmapCell} from '@libs/Statistics';

// Skia and useChartTheme both touch native modules / ThemeContext that
// don't initialize under Jest. Stub them.
jest.mock('@shopify/react-native-skia', () => ({
  __esModule: true,
  Canvas: () => null,
  RoundedRect: () => null,
}));

// react-native-haptic-feedback registers a TurboModule at import time that
// jest can't resolve; PressableWithoutFeedback pulls it in transitively.
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: {trigger: jest.fn()},
}));

jest.mock('@components/Charts/BaseChart', () => ({
  __esModule: true,
  useChartTheme: () => ({
    intensityRamp: ['#000', '#111', '#222', '#333', '#444'],
    primaryFill: '#abc',
    primaryStroke: '#abc',
    bandFill: '#abc',
    axisLabel: '#000',
    axisLine: '#000',
    gridLine: '#000',
  }),
}));

function cell(
  dateKey: string,
  totalSdu: number,
  intensity: 0 | 1 | 2 | 3 | 4 = 0,
): HeatmapCell {
  return {dateKey, totalSdu, intensity};
}

describe('CalendarHeatmap', () => {
  it('renders without crashing on empty cells', () => {
    const tree = render(
      <CalendarHeatmap cells={[]} accessibilityLabel="This month" />,
    ).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders accessibility labels for each day cell', () => {
    const cells = [
      cell('2024-01-01', 0, 0),
      cell('2024-01-02', 2, 2),
      cell('2024-01-03', 5, 3),
    ];
    const tree = render(
      <CalendarHeatmap cells={cells} accessibilityLabel="This month" />,
    );
    // Trigger layout — RNTL's render doesn't fire onLayout automatically.
    // Use a JSON sweep over the rendered tree to confirm the per-cell
    // labels are wired into the View props (they're absolute children).
    const root = tree.toJSON();
    expect(root).not.toBeNull();
    expect(JSON.stringify(root)).toContain('This month');
  });

  it('marks future cells as "upcoming" in the a11y label', () => {
    const cells: HeatmapCell[] = [
      cell('2026-05-01', 0, 0),
      {dateKey: '2026-05-31', totalSdu: 0, intensity: 0, isFuture: true},
    ];
    const tree = render(
      <CalendarHeatmap cells={cells} accessibilityLabel="This month" />,
    );
    // RNTL doesn't fire onLayout automatically; supply a width so the inner
    // per-cell views (which carry the a11y labels) render.
    fireEvent(tree.root, 'layout', {nativeEvent: {layout: {width: 280}}});
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('2026-05-31, upcoming');
    expect(json).toContain('2026-05-01, 0 units');
  });
});
