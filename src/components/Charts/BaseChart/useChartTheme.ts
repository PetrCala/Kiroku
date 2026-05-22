import {useMemo} from 'react';
import useTheme from '@hooks/useTheme';
import type {ChartTheme} from './types';

/**
 * Compose chart colors from the active app theme. The intensity ramp goes
 * from the chart background (theme.borderLighter) through translucent
 * yellow (theme.warning) up to orange (theme.add) for the heaviest bucket
 * — matches the "yellow → orange, never red" tone constraint in the
 * design doc §3.
 *
 * Note: `Preferences.units_to_colors` carries SDU *thresholds* (not
 * colors), so it does not feed the theme directly. Heatmap selectors
 * already own the bucketing thresholds — see selectCalendarHeatmap.
 */
function useChartTheme(): ChartTheme {
  const {textSupporting, border, borderLighter, appColor, warning, add} =
    useTheme();
  return useMemo<ChartTheme>(
    () => ({
      axisLabel: textSupporting,
      axisLine: border,
      gridLine: borderLighter,
      primaryFill: appColor,
      primaryStroke: appColor,
      // ~20% alpha suffix on the theme accent for the band-of-normal stripe.
      bandFill: `${appColor}33`,
      intensityRamp: [
        borderLighter,
        `${warning}55`,
        `${warning}AA`,
        warning,
        add,
      ],
    }),
    [textSupporting, border, borderLighter, appColor, warning, add],
  );
}

export default useChartTheme;
