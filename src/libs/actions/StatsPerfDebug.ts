import Onyx from 'react-native-onyx';
import StatsPerf from '@libs/StatsPerf';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
  StatsBackfillScope,
  StatsComputeScope,
} from '@src/types/onyx/StatsPerfDebug';

/**
 * Developer-only writes for the diagnostic StatsPerf panel (Test Tools). Gated
 * on the build environment (never production) rather than `IS_IN_PRODUCTION`, so
 * the gate is unambiguous on the ad-hoc release build used for device testing.
 */
function isWriteAllowed(): boolean {
  return CONFIG.ENVIRONMENT !== CONST.ENVIRONMENT.PROD;
}

/** Master switch for the `[StatsPerf]` instrumentation. */
function setLoggingEnabled(enabled: boolean): void {
  if (!isWriteAllowed()) {
    return;
  }
  Onyx.merge(ONYXKEYS.NVP_STATS_PERF_DEBUG, {loggingEnabled: enabled});
}

/** A/B lever: home scorecard event-compute scope (`window` = #1414, `full` = pre). */
function setComputeScope(scope: StatsComputeScope): void {
  if (!isWriteAllowed()) {
    return;
  }
  Onyx.merge(ONYXKEYS.NVP_STATS_PERF_DEBUG, {computeScope: scope});
}

/** A/B lever: launch-time backfill scope (`window` = #1414, `full` = pre). */
function setBackfillScope(scope: StatsBackfillScope): void {
  if (!isWriteAllowed()) {
    return;
  }
  Onyx.merge(ONYXKEYS.NVP_STATS_PERF_DEBUG, {backfillScope: scope});
}

/** Clear the in-memory counters and the readout (does not touch the toggles). */
function resetCounters(): void {
  if (!isWriteAllowed()) {
    return;
  }
  StatsPerf.reset();
}

export {setLoggingEnabled, setComputeScope, setBackfillScope, resetCounters};
