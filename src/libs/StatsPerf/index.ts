/**
 * Dependency-free performance counters for the Statistics / calendar stack.
 *
 * This is a DIAGNOSTIC instrument (not a shipped feature) for chasing the
 * post-#1414 device-build regression: profile/friends getting slower and the
 * infinite-scroll calendars stalling on skeletons. It counts the two things the
 * competing hypotheses hinge on:
 *   - runaway re-fires / Onyx writes (a render or backfill loop saturating the
 *     JS thread → everything downstream starves), and
 *   - `Intl` probe volume on the read path (the lost whole-history time-parts
 *     backfill forcing `resolveLocalParts` recomputes off the cold path).
 *
 * Kept intentionally free of Onyx / CONFIG / React imports so it can be dropped
 * into low-level pure utilities (`localParts`, `events`) without dragging those
 * heavy deps into their unit tests. The Onyx toggle, the build-environment gate
 * and the periodic flush live in `./connect`, which is imported only at app
 * setup. Until `setEnabled(true)` runs, every call here is a cheap no-op, so
 * tests and production are unaffected.
 */

/** High-resolution clock when available (RN polyfills `performance`), else 0. */
function nowMs(): number {
  const perf = (globalThis as {performance?: {now?: () => number}}).performance;
  return typeof perf?.now === 'function' ? perf.now() : 0;
}

let enabled = false;

/** Monotonic integer/float counters, keyed by a dotted metric name. */
const counters: Record<string, number> = {};
/** Snapshot taken at the last `snapshotDelta()` so the flusher can log deltas. */
const lastFlushed: Record<string, number> = {};

/**
 * Rolling formatted readout, oldest first. Held here (not in Onyx) so the Test
 * Tools panel can poll it while open without our own Onyx writes perturbing the
 * `cachedDrinkingSessions`-write count we are trying to measure.
 */
const reportLines: string[] = [];
const REPORT_MAX_LINES = 60;

/** Toggle instrumentation. Driven by `./connect` from the Onyx debug key. */
function setEnabled(next: boolean): void {
  enabled = next;
}

function isEnabled(): boolean {
  return enabled;
}

/** Add `n` to a counter (no-op when disabled). */
function inc(key: string, n = 1): void {
  if (!enabled) {
    return;
  }
  counters[key] = (counters[key] ?? 0) + n;
}

/** Time a synchronous call, accumulating `<key>.ms` and `<key>.calls`. */
function time<T>(key: string, fn: () => T): T {
  if (!enabled) {
    return fn();
  }
  const start = nowMs();
  const result = fn();
  counters[`${key}.ms`] = (counters[`${key}.ms`] ?? 0) + (nowMs() - start);
  counters[`${key}.calls`] = (counters[`${key}.calls`] ?? 0) + 1;
  return result;
}

/**
 * Open a timing span. Returns a start mark to pass to {@link measureFrom}, or 0
 * when disabled. Use across early returns where {@link time} can't wrap cleanly.
 */
function mark(): number {
  return enabled ? nowMs() : 0;
}

/** Close a span opened by {@link mark}, accumulating `<key>.ms` and `.calls`. */
function measureFrom(key: string, start: number): void {
  if (!enabled || start === 0) {
    return;
  }
  counters[`${key}.ms`] = (counters[`${key}.ms`] ?? 0) + (nowMs() - start);
  counters[`${key}.calls`] = (counters[`${key}.calls`] ?? 0) + 1;
}

/**
 * Counters that changed since the previous call, and advance the baseline.
 * `.ms` accumulators are rounded so the readout stays compact. Returns an empty
 * object when nothing moved (the flusher skips emitting an idle line).
 */
function snapshotDelta(): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const key of Object.keys(counters)) {
    const diff = counters[key] - (lastFlushed[key] ?? 0);
    if (diff !== 0) {
      delta[key] = key.endsWith('.ms') ? Math.round(diff) : diff;
      lastFlushed[key] = counters[key];
    }
  }
  return delta;
}

/** Append a formatted readout line (called by the flusher in `./connect`). */
function pushReportLine(line: string): void {
  reportLines.push(line);
  if (reportLines.length > REPORT_MAX_LINES) {
    reportLines.splice(0, reportLines.length - REPORT_MAX_LINES);
  }
}

/**
 * Emit an ad-hoc event line immediately (prefixed `~`), independent of the
 * periodic counter flush. Used to trace loading-gate / fetch state transitions
 * — the things that gate a screen *before* any instrumented compute runs, which
 * the counters can't see. No-op when disabled.
 */
function note(message: string): void {
  if (!enabled) {
    return;
  }
  pushReportLine(`~ ${message}`);
}

/** Current readout, oldest first (polled by the Test Tools panel). */
function getReportLines(): string[] {
  return reportLines;
}

/** Wipe all counters, the delta baseline, and the readout (Test Tools reset). */
function reset(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
  for (const key of Object.keys(lastFlushed)) {
    delete lastFlushed[key];
  }
  reportLines.length = 0;
}

export default {
  setEnabled,
  isEnabled,
  inc,
  time,
  mark,
  measureFrom,
  snapshotDelta,
  pushReportLine,
  note,
  getReportLines,
  reset,
};
