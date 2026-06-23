/** Which session window the home scorecard's event compute uses (A/B lever). */
type StatsComputeScope = 'window' | 'full';

/** Which session set the launch-time time-parts backfill covers (A/B lever). */
type StatsBackfillScope = 'window' | 'full';

/**
 * Diagnostic StatsPerf debug state (Test Tools panel). Lets the
 * post-#1414 regression be measured and bisected on a single ad-hoc device
 * build. Never present in production — writes are gated in
 * `@libs/actions/StatsPerfDebug`.
 */
type StatsPerfDebug = {
  /** Master switch for the `[StatsPerf]` instrumentation. */
  loggingEnabled?: boolean;
  /**
   * Home scorecard event-compute scope. `window` = #1414's optimisation (visible
   * + previous month); `full` = pre-#1414 whole-history compute. Bisects whether
   * the compute windowing is responsible for a symptom.
   */
  computeScope?: StatsComputeScope;
  /**
   * Launch-time time-parts backfill scope. `window` = #1414 (only the windowed
   * sessions); `full` = pre-#1414 (whole history). Bisects whether dropping the
   * full backfill is what slowed the other screens.
   */
  backfillScope?: StatsBackfillScope;
  /** Rolling profiler readout, oldest first, rendered live in Test Tools. */
  report?: string[];
};

export default StatsPerfDebug;
export type {StatsComputeScope, StatsBackfillScope};
