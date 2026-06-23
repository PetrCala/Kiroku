/**
 * Wires the dependency-free {@link StatsPerf} core to the app: the
 * build-environment gate, the Onyx logging toggle, and the periodic flush that
 * turns accumulated counters into a readable `[StatsPerf]` line (console + the
 * Test Tools readout). Imported once at app setup so the heavy Onyx / CONFIG
 * deps never reach the instrumented pure utilities.
 */
import Onyx from 'react-native-onyx';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import toggleTestToolsModal from '@userActions/TestTool';
import {
  resetCounters,
  setBackfillScope,
  setComputeScope,
  setLoggingEnabled,
} from '@userActions/StatsPerfDebug';
import StatsPerf from '.';

// Env-file driven (NOT NODE_ENV/`__DEV__`), so it is unambiguously true on the
// ad-hoc release build used for device testing and false on the store build.
const IS_BUILD_ALLOWED = CONFIG.ENVIRONMENT !== CONST.ENVIRONMENT.PROD;

const FLUSH_INTERVAL_MS = 2000;
// A flush window seeing this many `useDrinkEvents` effect re-fires (or backfill
// merges) is almost certainly a render/backfill loop rather than honest work —
// flag the line so it stands out in the readout.
const LOOP_FIRE_THRESHOLD = 30;

// Console driver exposed on `globalThis.statsPerfDebug` for the web dev console
// (the 4-finger Test Tools gesture is impractical with a mouse).
type StatsPerfConsole = {
  /** Returns the current readout lines (shows expandable in the console). */
  report: () => string[];
  /** Clear counters + readout. */
  clear: () => void;
  /** Master logging switch. */
  logging: (on: boolean) => void;
  /** A/B lever: home compute scope. */
  compute: (scope: 'window' | 'full') => void;
  /** A/B lever: backfill scope. */
  backfill: (scope: 'window' | 'full') => void;
  /** Pop the Test Tools panel. */
  open: () => void;
};

let initialized = false;
let loggingToggle = true;
let sequence = 0;

function applyEnabled(): void {
  StatsPerf.setEnabled(IS_BUILD_ALLOWED && loggingToggle);
}

/** Compact `key:value` rendering of the changed counters this window. */
function formatDelta(delta: Record<string, number>): string {
  return Object.keys(delta)
    .sort()
    .map(key => `${key}:${delta[key]}`)
    .join(' ');
}

function flush(): void {
  if (!StatsPerf.isEnabled()) {
    return;
  }
  const delta = StatsPerf.snapshotDelta();
  if (Object.keys(delta).length === 0) {
    return;
  }
  sequence += 1;
  const looped =
    (delta['useDrinkEvents.effectFire'] ?? 0) >= LOOP_FIRE_THRESHOLD ||
    (delta['backfill.merge'] ?? 0) >= LOOP_FIRE_THRESHOLD;
  const line = `#${sequence}${looped ? ' ⚠️LOOP' : ''} ${formatDelta(delta)}`;
  StatsPerf.pushReportLine(line);
  // eslint-disable-next-line no-console
  console.debug(`[StatsPerf] ${line}`);
}

/**
 * Start instrumentation. No-op on the production build. Defaults logging on for
 * every non-prod build; the Test Tools toggle (persisted in
 * `NVP_STATS_PERF_DEBUG.loggingEnabled`) can turn it off without a rebuild.
 */
function init(): void {
  if (initialized || !IS_BUILD_ALLOWED) {
    return;
  }
  initialized = true;
  // This is a plain module (no React), so it can't use `useOnyx`; a module-level
  // `Onyx.connect` is the established pattern for reacting to a toggle key here
  // (cf. `@userActions/TestTool`). Diagnostic-only and gated to non-production.
  // eslint-disable-next-line rulesdir/no-onyx-connect
  Onyx.connect({
    key: ONYXKEYS.NVP_STATS_PERF_DEBUG,
    callback: value => {
      loggingToggle = value?.loggingEnabled ?? true;
      applyEnabled();
    },
  });
  applyEnabled();
  setInterval(flush, FLUSH_INTERVAL_MS);

  // Drive everything from the web dev console, e.g. `statsPerfDebug.report()`,
  // `statsPerfDebug.compute('full')`, `statsPerfDebug.backfill('full')`,
  // `statsPerfDebug.open()`. Set only on the non-prod build (this whole init is
  // gated above).
  const consoleApi: StatsPerfConsole = {
    report: () => [...StatsPerf.getReportLines()],
    clear: resetCounters,
    logging: setLoggingEnabled,
    compute: setComputeScope,
    backfill: setBackfillScope,
    open: toggleTestToolsModal,
  };
  (globalThis as {statsPerfDebug?: StatsPerfConsole}).statsPerfDebug =
    consoleApi;
}

export default {init};
