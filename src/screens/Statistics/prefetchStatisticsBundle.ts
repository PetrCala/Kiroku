/**
 * Eagerly evaluate the Statistics chart-tab module so the first open of the
 * Statistics tab is a cache hit instead of a ~1.5s cold parse of
 * `react-native-tab-view` + the chart graph. The specifier matches
 * `StatisticsScreen`'s `import('./StatisticsTabs')`, so Metro evaluates the
 * module once and the open reuses it.
 *
 * Fire-and-forget: a single-bundle dynamic import only rejects if the module
 * itself throws, in which case the on-open parse simply runs as before.
 */
function prefetchStatisticsBundle(): Promise<unknown> {
  return import('./StatisticsTabs').catch(() => undefined);
}

export default prefetchStatisticsBundle;
