/**
 * Lightweight, opt-in timing for the Statistics v2 tabs. Measures the two
 * costs a user pays the first time they open a non-Overview tab:
 *
 *   1. module realization — the lazy `import()` of the tab's Skia/victory chart
 *      bundle (the "chart bundle parsed" gate), via {@link measureImport};
 *   2. aggregation        — `buildDrinkEvents` plus each per-tab `aggregate` /
 *      build pass, via {@link measure}.
 *
 * Sum the `import …` lines vs. the rest to see which dominates the stall:
 * module-bound favours preloading the tab modules, aggregation-bound favours
 * fusing the per-tab passes.
 *
 * Disabled in production (a no-op passthrough — call sites read the same as
 * without it). Flip {@link STATS_PERF_ENABLED} to `true` to profile a release /
 * on-device build; `console.log` is captured into the in-app debug console in
 * non-dev builds when "Store logs" is on (see `@libs/Console`), so the split
 * can be read on a physical device without Metro.
 *
 * Absolute numbers in a `__DEV__` build are inflated by dev-mode React — the
 * ratio between module-load and aggregation is the signal, not the magnitude.
 *
 * Kept dependency-free on purpose: routing through `@libs/Log` would pull Onyx
 * in at import time, which is overkill for a dev probe and trips hooks tests
 * that don't mock Onyx.
 */

// Flip to `true` to keep timing on in a release / on-device profiling build.
const STATS_PERF_ENABLED = __DEV__;

const PREFIX = '[StatsPerf]';

function round(ms: number): number {
  return Math.round(ms * 10) / 10;
}

function report(
  label: string,
  durationMs: number,
  extra?: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.log(`${PREFIX} ${label} ${round(durationMs)}ms`, {
    durationMs: round(durationMs),
    ...extra,
  });
}

/**
 * Time a synchronous block — an aggregation pass (`buildDrinkEvents`,
 * `aggregate`, a Trends `useMemo` body). Returns the block's value untouched.
 */
function measure<T>(
  label: string,
  fn: () => T,
  extra?: Record<string, unknown>,
): T {
  if (!STATS_PERF_ENABLED) {
    return fn();
  }
  const start = performance.now();
  const result = fn();
  report(label, performance.now() - start, extra);
  return result;
}

/**
 * Wrap a `lazy(() => import(...))` loader so the dynamic-import duration is
 * logged the first time the tab is activated. Returns the loader unchanged
 * when disabled.
 */
function measureImport<T>(
  label: string,
  loader: () => Promise<T>,
): () => Promise<T> {
  if (!STATS_PERF_ENABLED) {
    return loader;
  }
  return () => {
    const start = performance.now();
    return loader().then(module => {
      report(`import ${label}`, performance.now() - start);
      return module;
    });
  };
}

export {STATS_PERF_ENABLED, measure, measureImport};
