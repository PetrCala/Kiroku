/**
 * Dev-only cold-launch profiler for the Statistics screen. Records a single
 * timeline anchored at screen mount and logs each gate's offset from the origin
 * plus the delta since the previous gate, so a cold open reads top-to-bottom in
 * the Metro console:
 *
 *   [StatsProfile] ----- cold run start -----
 *   [StatsProfile] +312ms (Δ312ms) transition end
 *   [StatsProfile] +540ms (Δ228ms) chart bundle parsed
 *   [StatsProfile] +560ms (Δ20ms)  sessions hydrated
 *   [StatsProfile] +2100ms (Δ1540ms) older-months fetch settled
 *   [StatsProfile] +2105ms buildDrinkEvents 2148ms - 612 sessions -> 8234 events
 *   [StatsProfile] +4260ms (Δ2160ms) first events ready {"events":8234}
 *   [StatsProfile] +4320ms (Δ60ms)  overview tab data ready
 *
 * Each phase label is logged once per run (first occurrence wins) so the many
 * `useDrinkEvents` instances and React re-renders that hit the same gate do not
 * duplicate it. `buildDrinkEvents` is logged on every real compute pass (no
 * dedupe) so a trace reveals whether the stream is rebuilt once or N times as
 * months stream in.
 *
 * Disabled in production and under Jest. This is a diagnostic, not a product
 * feature — remove once the Statistics load has been optimised.
 */

const ENABLED = __DEV__ && process.env.NODE_ENV !== 'test';
const PREFIX = '[StatsProfile]';

let originMs: number | null = null;
let lastMs = 0;
const seen = new Set<string>();

function fmt(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

/** Begin a fresh capture. Call once on Statistics screen mount. */
function resetStatsProfile(): void {
  if (!ENABLED) {
    return;
  }
  originMs = performance.now();
  lastMs = originMs;
  seen.clear();
  console.debug(`${PREFIX} ----- cold run start -----`);
}

/** Record a one-shot gate. Repeat labels within a run are ignored. */
function markStatsPhase(label: string, extra?: Record<string, unknown>): void {
  if (!ENABLED || originMs === null || seen.has(label)) {
    return;
  }
  seen.add(label);
  const now = performance.now();
  const sinceStart = now - originMs;
  const sinceLast = now - lastMs;
  lastMs = now;
  const detail = extra ? ` ${JSON.stringify(extra)}` : '';
  console.debug(
    `${PREFIX} +${fmt(sinceStart)} (Δ${fmt(sinceLast)}) ${label}${detail}`,
  );
}

/** Record a `buildDrinkEvents` compute pass — every real (non-cached) rebuild. */
function logBuildDrinkEvents(
  durationMs: number,
  sessionCount: number,
  eventCount: number,
): void {
  if (!ENABLED) {
    return;
  }
  const at = originMs === null ? '' : `+${fmt(performance.now() - originMs)} `;
  console.debug(
    `${PREFIX} ${at}buildDrinkEvents ${fmt(durationMs)} - ${sessionCount} sessions -> ${eventCount} events`,
  );
}

export {resetStatsProfile, markStatsPhase, logBuildDrinkEvents};
