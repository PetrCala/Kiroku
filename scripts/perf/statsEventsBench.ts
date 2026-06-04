/* eslint-disable no-console */
/**
 * Isolated micro-benchmark for `buildDrinkEvents` candidates. Runs OUTSIDE jest
 * (jest's global fake timers freeze `performance.now`) via:
 *
 *   npx ts-node scripts/perf/statsEventsBench.ts
 *
 * Flags:
 *   --iterations=N   timed iterations per candidate (default 25)
 *   --warmup=N       warmup iterations (default 5)
 *   --segments       run the baseline hot-path segment breakdown
 *   --zone=Area/City dataset timezone (default Europe/London)
 *
 * The module-level last-call cache in the baseline is defeated by passing a
 * fresh top-level `sessions` wrapper object each iteration (same inner data),
 * so every iteration does real work.
 */
import './benchGlobals';
import {performance, PerformanceObserver} from 'node:perf_hooks';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {UserDrinkingSessionsList} from '@src/types/onyx/DrinkingSession';
import type {WeekStart} from '@libs/Statistics/types';
import {CANDIDATES} from './statsCandidates';
import type {Candidate} from './statsCandidates';
import {standardDatasets, UNITS, DEFAULTS} from './statsDataset';
import type {GenResult} from './statsDataset';

const argv = process.argv.slice(2);
function flag(name: string, dflt: string): string {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
}
const ITER = Number(flag('iterations', '25'));
const WARMUP = Number(flag('warmup', '5'));
const ZONE = flag('zone', 'Europe/London') as SelectedTimezone;
const RUN_SEGMENTS = argv.includes('--segments');
const RUN_GC = argv.includes('--gc');

const MON: WeekStart = 1;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
}

/** Fresh top-level wrapper each call → defeats baseline's identity cache. */
function rewrap(sessions: UserDrinkingSessionsList): UserDrinkingSessionsList {
  return {...sessions};
}

function timeCandidate(
  cand: Candidate,
  ds: GenResult,
): {median: number; mean: number; stdev: number; events: number} {
  let events = 0;
  for (let i = 0; i < WARMUP; i++) {
    events = cand.fn(rewrap(ds.sessions), UNITS, DEFAULTS, ZONE, MON).length;
  }
  const samples: number[] = [];
  for (let i = 0; i < ITER; i++) {
    const wrapped = rewrap(ds.sessions);
    const t0 = performance.now();
    const out = cand.fn(wrapped, UNITS, DEFAULTS, ZONE, MON);
    const t1 = performance.now();
    samples.push(t1 - t0);
    events = out.length;
  }
  return {
    median: median(samples),
    mean: mean(samples),
    stdev: stdev(samples),
    events,
  };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function padL(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function runMainTable(): void {
  const datasets = standardDatasets(ZONE);
  const sizes = ['small', 'medium', 'large'] as const;

  console.log(`\nStatistics buildDrinkEvents benchmark`);
  console.log(
    `node ${process.version} · zone ${ZONE} · warmup ${WARMUP} · iterations ${ITER} (median ms)\n`,
  );
  for (const size of sizes) {
    const ds = datasets[size];
    console.log(
      `${size.toUpperCase()}: ${ds.sessionCount} sessions → ${ds.eventCount} events`,
    );
  }
  console.log('');

  // Header
  const col = 22;
  const numc = 26;
  let header = pad('candidate', col);
  for (const size of sizes) {
    const ds = datasets[size];
    header += padL(`${size} (${(ds.eventCount / 1000).toFixed(1)}k ev)`, numc);
  }
  console.log(header);
  console.log('-'.repeat(col + numc * sizes.length));

  const table: Record<string, Record<string, number>> = {};
  for (const cand of CANDIDATES) {
    let row = pad(cand.label, col);
    table[cand.key] = {};
    for (const size of sizes) {
      const r = timeCandidate(cand, datasets[size]);
      table[cand.key][size] = r.median;
      row += padL(`${r.median.toFixed(1)} ±${r.stdev.toFixed(1)}`, numc);
    }
    console.log(row);
  }

  // Speedup vs baseline
  console.log('\nspeedup vs (a) baseline (median):');
  let srow = pad('candidate', col);
  for (const size of sizes) {
    srow += padL(size, numc);
  }
  console.log(srow);
  console.log('-'.repeat(col + numc * sizes.length));
  for (const cand of CANDIDATES) {
    let row = pad(cand.label, col);
    for (const size of sizes) {
      const base = table.a[size];
      const x = base / table[cand.key][size];
      row += padL(`${x.toFixed(2)}×`, numc);
    }
    console.log(row);
  }
  console.log('');
}

// ─────────────────────── baseline hot-path segment profile ──────────────────
// Re-implements the baseline inline so each stage can be timed independently.
// Mirrors src/libs/Statistics/events.ts exactly; for diagnosis only.

function runSegments(): void {
  const ds = standardDatasets(ZONE).large;
  const sessions = ds.sessions;
  console.log(
    `\nSegment profile — LARGE (${ds.eventCount} events), zone ${ZONE}`,
  );
  console.log(`(sum over ${ITER} iterations, median per-iter ms)\n`);

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });

  type Acc = {
    iterTotal: number[];
    formatToParts: number[];
    dateAlloc: number[];
    stringBuild: number[];
    normalize: number[];
    push: number[];
  };
  const acc: Acc = {
    iterTotal: [],
    formatToParts: [],
    dateAlloc: [],
    stringBuild: [],
    normalize: [],
    push: [],
  };

  for (let it = 0; it < WARMUP + ITER; it++) {
    let tFmt = 0;
    let tDate = 0;
    let tStr = 0;
    let tNorm = 0;
    let tPush = 0;
    const events: unknown[] = [];
    const iterStart = performance.now();

    for (const userId of Object.keys(sessions)) {
      const us = sessions[userId];
      if (!us) {
        continue;
      }
      for (const sid of Object.keys(us)) {
        const session = us[sid];
        if (!session || session.ongoing === true) {
          continue;
        }
        const startMs = Number(session.start_time);
        if (!Number.isFinite(startMs)) {
          continue;
        }
        const drinks = session.drinks;
        if (!drinks) {
          continue;
        }
        for (const [tsKey, drinksAtTs] of Object.entries(drinks)) {
          const ts = Number(tsKey);
          if (!Number.isFinite(ts) || !drinksAtTs) {
            continue;
          }

          // segment: formatToParts
          let s = performance.now();
          const fields: Record<string, string> = {};
          for (const part of fmt.formatToParts(ts)) {
            fields[part.type] = part.value;
          }
          tFmt += performance.now() - s;

          const {year, month, day, hour} = fields;

          // segment: Date allocations (ISO week + DOW)
          s = performance.now();
          const localMidnightUtc = Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
          );
          const thursday = new Date(localMidnightUtc);
          const dayFromMonday = (thursday.getUTCDay() + 6) % 7;
          thursday.setUTCDate(thursday.getUTCDate() - dayFromMonday + 3);
          const isoYear = thursday.getUTCFullYear();
          const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
          const firstOffset = (firstThursday.getUTCDay() + 6) % 7;
          firstThursday.setUTCDate(
            firstThursday.getUTCDate() - firstOffset + 3,
          );
          const week =
            1 +
            Math.round(
              (thursday.getTime() - firstThursday.getTime()) / 604_800_000,
            );
          const calendarDow = new Date(localMidnightUtc).getUTCDay();
          tDate += performance.now() - s;

          // segment: string building
          s = performance.now();
          const localDay = `${year}-${month}-${day}`;
          const localMonth = `${year}-${month}`;
          const localIsoWeek = `${String(isoYear).padStart(4, '0')}-W${String(
            week,
          ).padStart(2, '0')}`;
          const localHour = Number(hour) % 24;
          tStr += performance.now() - s;

          const localDow = (calendarDow - 1 + 7) % 7;
          const isWeekend = calendarDow === 0 || calendarDow === 6;

          for (const drinkKeyRaw of Object.keys(drinksAtTs)) {
            // segment: normalize
            s = performance.now();
            const raw = (drinksAtTs as Record<string, unknown>)[drinkKeyRaw];
            let ok = false;
            let count = 0;
            if (typeof raw === 'number') {
              ok = Number.isFinite(raw) && raw > 0;
              count = raw;
            } else if (raw && typeof raw === 'object') {
              const o = raw as {count?: unknown};
              ok =
                typeof o.count === 'number' &&
                Number.isFinite(o.count) &&
                o.count > 0;
              count = ok ? (o.count as number) : 0;
            }
            tNorm += performance.now() - s;
            if (!ok) {
              continue;
            }

            // segment: push
            s = performance.now();
            events.push({
              userId,
              sessionId: sid,
              ts,
              localDay,
              localIsoWeek,
              localMonth,
              localHour,
              localDow,
              isWeekend,
              drinkKey: drinkKeyRaw,
              count,
              units: count,
              blackoutSession: session.blackout === true,
            });
            tPush += performance.now() - s;
          }
        }
      }
    }

    const iterTotal = performance.now() - iterStart;
    if (it >= WARMUP) {
      acc.iterTotal.push(iterTotal);
      acc.formatToParts.push(tFmt);
      acc.dateAlloc.push(tDate);
      acc.stringBuild.push(tStr);
      acc.normalize.push(tNorm);
      acc.push.push(tPush);
    }
  }

  const rows: Array<[string, number[]]> = [
    ['formatToParts', acc.formatToParts],
    ['Date alloc (ISO-week + DOW)', acc.dateAlloc],
    ['string building', acc.stringBuild],
    ['normalizeEntry', acc.normalize],
    ['events.push', acc.push],
  ];
  const total = median(acc.iterTotal);
  console.log(
    `${pad('segment', 32)}${padL('median ms', 14)}${padL('% of pass', 12)}`,
  );
  console.log('-'.repeat(58));
  for (const [name, xs] of rows) {
    const m = median(xs);
    console.log(
      `${pad(name, 32)}${padL(m.toFixed(2), 14)}${padL(`${((m / total) * 100).toFixed(1)}%`, 12)}`,
    );
  }
  console.log('-'.repeat(58));
  console.log(
    `${pad('full pass (instrumented)', 32)}${padL(total.toFixed(2), 14)}`,
  );
  console.log(
    `\nNote: per-segment performance.now() adds overhead, inflating the\n` +
      `instrumented total vs the clean benchmark; use the ratios, not the absolutes.\n`,
  );
}

// ───────────────────────── GC-pressure measurement ──────────────────────────
// Total GC pause time + collection count over a fixed loop count. A proxy for
// transient-allocation pressure — the on-device cost that shows up as jank.
// Run with: node --expose-gc -r ts-node/register/transpile-only ... --gc

const tick = () =>
  new Promise<void>(res => {
    setTimeout(res, 0);
  });

async function runGc(): Promise<void> {
  const ds = standardDatasets(ZONE).large;
  const LOOPS = Number(flag('loops', '120'));
  console.log(`\nGC pressure — LARGE (${ds.eventCount} events), zone ${ZONE}`);
  console.log(`(${LOOPS} loops per candidate)\n`);
  console.log(
    `${pad('candidate', 32)}${padL('GC count', 12)}${padL('GC time ms', 14)}${padL(
      'ms/loop',
      12,
    )}`,
  );
  console.log('-'.repeat(70));

  const gc = (globalThis as {gc?: () => void}).gc;
  for (const cand of CANDIDATES) {
    let gcCount = 0;
    let gcTime = 0;
    const obs = new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        gcCount += 1;
        gcTime += e.duration;
      }
    });
    obs.observe({entryTypes: ['gc'], buffered: true});
    if (gc) {
      gc();
    }
    let sink = 0;
    for (let i = 0; i < LOOPS; i++) {
      sink += cand.fn({...ds.sessions}, UNITS, DEFAULTS, ZONE, MON).length;
    }
    await tick(); // let queued GC entries flush before reading
    obs.disconnect();
    if (sink <= 0) {
      throw new Error('benchmark produced no events');
    }
    console.log(
      `${pad(cand.label, 32)}${padL(String(gcCount), 12)}${padL(
        gcTime.toFixed(1),
        14,
      )}${padL((gcTime / LOOPS).toFixed(3), 12)}`,
    );
  }
  console.log(
    `\n(Run under \`node --expose-gc\` for accurate, deterministic GC counts.)\n`,
  );
}

if (RUN_SEGMENTS) {
  runSegments();
} else if (RUN_GC) {
  runGc().catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
} else {
  runMainTable();
}
