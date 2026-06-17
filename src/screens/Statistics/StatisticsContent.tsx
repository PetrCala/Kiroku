import StatsContextProvider from '@components/StatsContextProvider';
import DrillDownProvider from './drilldown/DrillDownContext';
import StatisticsTabs from './StatisticsTabs';
import StatsDrillDownSheet from './StatsDrillDownSheet';

/**
 * The full Statistics subtree — the stats providers, the chart tabs, and the
 * drill-down sheet — pulled out of `StatisticsScreen` so it can be loaded as a
 * single dynamic import once the screen has settled.
 *
 * Keeping these together (rather than statically imported by the screen) means
 * the screen's first commit only has to mount the header + skeleton: the
 * `StatsContextProvider` compute, the Skia/Victory chart bundle, and the
 * drill-down sheet are all deferred to this module, minimizing the blank
 * native-tab window before the skeleton paints.
 *
 * Provider nesting mirrors what `StatisticsScreen` rendered inline, so every
 * context consumer (`useStatsContext`, `useStatsDrillDown` in the tabs and the
 * sheet) keeps working unchanged.
 */
function StatisticsContent() {
  return (
    <StatsContextProvider>
      <DrillDownProvider>
        <StatisticsTabs />
        <StatsDrillDownSheet />
      </DrillDownProvider>
    </StatsContextProvider>
  );
}

StatisticsContent.displayName = 'StatisticsContent';

export default StatisticsContent;
