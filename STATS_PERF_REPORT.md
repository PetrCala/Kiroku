# Statistics event-stream materialization — performance deep-dive

**Scope:** `buildDrinkEvents` in `src/libs/Statistics/events.ts` — the function
that turns raw Onyx drinking sessions into the flat `DrinkEvent[]` every
Statistics chart reduces over. A cold Statistics open took ~5 s; an in-app
profiler (`src/libs/Statistics/profiling.ts`) pinned the cost to this function
(~5096 ms for 161 sessions → 717 events on device), entirely CPU — no I/O.

A first optimization already landed on `claude/sleepy-satoshi-d9cb40`: the five
per-timestamp `formatInTimeZone` (date-fns-tz) calls were collapsed into one
cached `Intl.DateTimeFormat` + `formatToParts`, with ISO-week / day-of-week
derived arithmetically. **That is the baseline this report measures against.**

**TL;DR (node):** The per-timestamp `Intl` call is ~60–66% of the pass.
Resolving each timezone's UTC-offset transitions _once_ into a table and deriving
every local field by integer arithmetic (candidate **c**) is **~2× faster on
large datasets in node (V8)**, allocates ~30% fewer GC cycles, is byte-identical
across an exhaustive timezone sweep, and is _more_ correct than date-fns-tz at
DST boundaries.

> ## ⚠️ Device result: candidate (c) REGRESSES on Hermes — reverted
>
> Candidate (c) was adopted, **device-tested, and reverted.** On Hermes it is
> **~3.5× _slower_** than the baseline for the real workload:
>
> | build                                 | `buildDrinkEvents` | dataset                   |
> | ------------------------------------- | ------------------ | ------------------------- |
> | master (baseline, 1× `formatToParts`) | **1039 ms**        | 163 sessions → 724 events |
> | PR (candidate c, offset-table)        | **3703 ms**        | 163 sessions → 724 events |
>
> **Why the node benchmark lied** (see the on-device caveat in §1): (1) Hermes
> `Intl` is ~1000× slower
> than V8's — the cost is ~linear in the _number of `Intl` calls_ (~2–3 ms each
> on Hermes). (2) The offset-table replaces "1 `Intl` call per timestamp" with
> "many `Intl` calls to build a transition table" (coarse scan + ~30-probe binary
> search per DST transition); cheap on V8, the bottleneck on Hermes. (3) The
> table-build cost scales with the **data time-span, not the event count** — the
> real dataset is small (724 events) but spans years (and can contain outlier
> timestamps that inflate the range), so it did _more_ `Intl` work than the
> baseline.
>
> **Conclusion:** the already-landed 5→1 fix captured the real win (~5×, matching
> the ~5× drop from 5096 ms → 1039 ms). The baseline is near-optimal for any
> per-timestamp-`Intl` approach. `events.ts` is left on the baseline. The
> harness, candidate code, and correctness suite are kept as an investigation
> record. Real next steps in §6.

---

## 1. Methodology

- **Isolated micro-benchmarks**, not the in-app trace. The in-app number is
  inflated 1–2 orders of magnitude by Hermes dev mode + React dev mode; it tells
  us _where_ the cost is, not a clean ms figure. The harness calls
  `buildDrinkEvents` directly on synthetic data with real `performance.now()`.
- **Run outside Jest.** `jest.config.js` sets `fakeTimers.enableGlobally`, which
  freezes `performance.now()` — useless for timing. The benchmark runs under
  `ts-node` (`scripts/perf/`); Jest is used only for correctness.
- **Datasets** (`scripts/perf/statsDataset.ts`): deterministic (seeded
  mulberry32 PRNG), near-daily sessions over 1 / 3 / 5 years, 1–8 drink
  timestamps per session, 1–6 drink types per timestamp, 30% v2-A object
  entries. Sizes land near the 1k / 10k / 50k event targets:

  | dataset | span | sessions | events |
  | ------- | ---- | -------- | ------ |
  | small   | 1 yr | 326      | 1,307  |
  | medium  | 3 yr | 998      | 12,302 |
  | large   | 5 yr | 1,785    | 48,320 |

- **Timing:** warmup iterations then N timed iterations; report **median ms**
  (± stdev). A fresh top-level `sessions` wrapper is passed each iteration so the
  module-level identity cache in `buildDrinkEvents` never short-circuits real
  work.
- **Profiling:** node `--cpu-prof` (self-time attribution) plus a manual
  per-segment `performance.now()` breakdown.
- **GC:** `--trace-gc` in a separate process per candidate (reliable per-process
  counts).
- **Correctness oracle:** the platform's native `Intl` for wall-clock fields
  (the exact engine the app runs on) and date-fns for ISO-week / DOW computed
  from the civil date at noon. See §4 for why date-fns is _not_ used as the
  wall-clock oracle.

> **On-device caveat (this prediction was WRONG — see the device-result box
> above):** I expected Hermes' slower `Intl` to make (c)'s win _larger_ on
> device. The opposite happened. The flaw: V8's `Intl` is so fast that the
> offset-table's table-build calls are invisible in node, so the benchmark only
> measured the per-timestamp savings. On Hermes every `Intl` call costs ~2–3 ms,
> the table-build calls dominate, and (c) regresses. **Lesson: an `Intl`-heavy
> setup cost that is free on V8 can be the entire cost on Hermes — micro-benchmark
> the call _count_, not just node wall-time, and always confirm on device.**

Reproduce:

```bash
ln -s /Users/petr/code/Kiroku/node_modules node_modules   # worktrees only
npx ts-node --project scripts/perf/tsconfig.json scripts/perf/statsEventsBench.ts
npx ts-node --project scripts/perf/tsconfig.json scripts/perf/statsEventsBench.ts --segments
node --expose-gc -r ts-node/register/transpile-only scripts/perf/statsEventsBench.ts --gc   # TS_NODE_PROJECT=scripts/perf/tsconfig.json
npx jest __tests__/unit/libs/Statistics/eventsCandidates.test.ts
```

---

## 2. Where the time goes (baseline hot-path)

**Per-segment breakdown** (large dataset, instrumented):

| segment                       | % of pass |
| ----------------------------- | --------- |
| `formatToParts` (Intl)        | **60.5%** |
| `Date` alloc (ISO-week + DOW) | 11.2%     |
| `events.push`                 | 7.5%      |
| `normalizeEntry`              | 3.9%      |
| string building               | 2.9%      |
| (loop / iteration overhead)   | ~14%      |

**`--cpu-prof` self-time** (baseline, 300× large, independent confirmation):

| function                         | self-time |
| -------------------------------- | --------- |
| `resolveLocalParts` (incl. Intl) | **65.8%** |
| `buildDrinkEvents` (per-event)   | 17.0%     |
| garbage collector                | 7.0%      |
| `isoWeekLabel` (2 `Date` allocs) | 6.4%      |

Both methods agree: **timezone resolution dominates (~66–73%)** — the per-
timestamp `Intl` call plus the `Date` allocations behind ISO-week/DOW (which also
drive most of the GC). The per-event loop (`normalizeEntry` + SDU + `push`) is
~17–20% and is the irreducible floor — no timezone trick removes it. This
predicts the ceiling: an approach that fully eliminates per-timestamp timezone
work caps out around **3–4×**, and lands at ~2× once the per-event floor
dominates on large data.

---

## 3. Candidates & results

All candidates keep the exact `buildDrinkEvents` signature and `DrinkEvent`
output shape (`scripts/perf/statsCandidates.ts`).

- **(a) Baseline** — cached `Intl` formatter, one `formatToParts` per timestamp,
  ISO-week/DOW via `Date`. _(The already-landed optimization.)_
- **(b) Day-bucket memo** — one `Intl` offset probe per distinct _local day_
  (plus a cheap far-edge probe to detect intra-day DST transitions); same-day
  timestamps derive the hour arithmetically; full per-timestamp probe only on
  the ≤2 DST-transition days/year.
- **(c) Offset-table arithmetic** — each zone's UTC-offset _transitions_ are
  located once (a handful of `Intl` probes via coarse scan + binary search) into
  a sorted table; every timestamp then resolves to all local fields (day, month,
  hour, ISO week, DOW) by **pure integer arithmetic** — zero `Intl`, zero `Date`
  allocation per timestamp.

### Throughput — median ms (node v20, Europe/London, DST)

| candidate           | small (1.3k) | medium (12.3k) | large (48.3k) |
| ------------------- | ------------ | -------------- | ------------- |
| (a) baseline        | 3.1          | 11.7           | 39.4          |
| (b) day-bucket memo | 2.8          | 11.8           | 32.7          |
| (c) offset-table    | **1.0**      | **5.8**        | **18.8**      |

**Speedup vs baseline:**

| candidate           | small | medium | large |
| ------------------- | ----- | ------ | ----- |
| (b) day-bucket memo | 1.10× | 0.99×  | 1.21× |
| (c) offset-table    | 3.06× | 2.01×  | 2.10× |

No-DST zone (Asia/Tokyo) — (c) does even better because the table is a single
entry: **3.92× / 2.25× / 2.26×**.

### GC pressure — collections over 200× large (`--trace-gc`, per-process)

| candidate        | total GC | scavenge | major |
| ---------------- | -------- | -------- | ----- |
| (a) baseline     | 297      | 282      | 15    |
| (b) day-bucket   | 196      | 178      | 18    |
| (c) offset-table | 214      | 192      | 22    |

The output array is identical across candidates (same retained size), so the
differentiator is _transient_ allocation: the baseline allocates ~3 `Date`
objects + a parts array + a fields object per timestamp; (c) drops the `Date`
objects → **~28% fewer GC cycles**, i.e. fewer frame-drop opportunities on
device.

### Why (b) underperforms

(b) only attacks the per-timestamp work, but (i) its per-day probe must be a
_full_ (6-field) offset probe plus a transition-edge probe (2 probes/day), and
(ii) the per-event floor (~17–20%) is untouched. Net: marginal and noisy
(0.99–1.5×). Not worth its added complexity.

### Maintainability notes

- **(a):** simplest, ~25 lines of tz logic. Per-timestamp `Intl` is the cost.
- **(b):** medium complexity (day-range cache + transition edge-probe) for a
  marginal, noisy win. **Rejected.**
- **(c):** +~120 lines (offset transition table: coarse scan, binary-search
  transition pinning, table lookup, Hinnant civil-date math). More code, but
  self-contained and covered by an exhaustive correctness suite kept in-repo.
  One documented assumption: the transition scan stride (`SCAN_STEP_MS`, 8 days)
  must be shorter than the gap between consecutive offset transitions in the
  covered range — true for every IANA zone in the modern era (transitions are
  months apart), and drink timestamps are recent.

### Post-adoption confirmation

Re-profiling the shipped `events.ts` after adopting (c): total self-time
**~4.4 s vs ~11.4 s** (300× large) — `formatToParts` is gone from the hot path;
`offsetSecondsAt` (the `Intl` probe) is now only 12.3% because it runs ~once per
zone, and the per-event loop (37.3%) is the new top cost — exactly the predicted
floor. The added range pre-scan (`drinkTimestampRange`) is ~5%.

---

## 4. Correctness

Every candidate must pass the existing
`__tests__/unit/libs/Statistics/events.test.ts` **unchanged** (29 tests — DST
forward/backward in Europe/London, Tokyo cross-day, NY fallback, leap day,
2020-W53 edge, DOW rotation). ✅ All green against the adopted implementation.

A new suite `__tests__/unit/libs/Statistics/eventsCandidates.test.ts` (30 tests)
exercises all three candidates against the oracle:

- **Hard-timezone oracle sweep** — >10,000 samples per zone (7h11m stride across
  2017–2026, deliberately off the hour/day grid), for **11 zones**: UTC,
  Europe/London, America/New_York, Asia/Tokyo, **Asia/Kolkata (+5:30)**,
  **Asia/Kathmandu (+5:45)**, **Australia/Sydney**, **Pacific/Auckland**
  (southern-hemisphere DST), **Australia/Lord_Howe (30-minute DST)**,
  **Pacific/Chatham (+12:45/+13:45)**, **America/Sao_Paulo** (DST abolished
  2019). ✅
- **Explicit DST-transition brackets** — ±1 s / ±1 min / ±1 h around each
  spring-forward and fall-back instant, including Lord Howe's 30-minute jumps. ✅
- **Pre-1970 instants** — moon landing, 1965, 1955, 1945, 1900 across UTC /
  London / Kolkata / Tokyo (whole-_second_ offset handling covers LMT). ✅
- **Cross-equality** — on a 4-year synthetic dataset (>1000 events) in
  Europe/London, Australia/Lord_Howe, Asia/Kathmandu, Pacific/Auckland, (b) and
  (c) reproduce the baseline event stream **byte-for-byte** (`toEqual`). ✅

### Finding: date-fns-tz is wrong at the exact spring-forward instant

The brief specified date-fns `formatInTimeZone` as the oracle. While building the
sweep it surfaced a **date-fns-tz bug**: at the precise spring-forward second the
clock jumps 01:00→02:00 local, so `2021-03-28 01:00:00 UTC` is `02:00 BST` in
London. Native `Intl` (and therefore every candidate, including the shipped
baseline) reports **hour 2**; date-fns-tz reports **hour 3**.

```
UTC 2021-03-28T01:00:00Z | date-fns-tz: 03:00 (WRONG) | native Intl: 02:00 | a/b/c: 2
```

Consequences:

1. The oracle was switched to **native `Intl`** for wall-clock fields (the
   on-device ground truth); ISO-week/DOW use date-fns from the civil date at
   _noon_ (never a transition instant), keeping that check independent of the
   candidates' own arithmetic.
2. The Intl-based event builder (baseline and (c)) is **strictly more correct**
   than the _original_ date-fns-tz code it replaced — a latent off-by-one-hour
   bug at DST spring-forward existed in the pre-optimization Statistics path and
   anywhere else that still calls `formatInTimeZone` (see §5). This is captured
   by a dedicated regression test.

---

## 5. Cross-repo timezone audit

`rg "formatInTimeZone|date-fns-tz|getTimezoneOffset|Intl.DateTimeFormat" src`
plus review of Day Overview, SessionsCalendar, and shared date utilities. The
same "date-fns-tz per item in a loop over a session/event collection" pattern
recurs:

| call site                                                                                  | pattern                            | heat        | notes                                                                             |
| ------------------------------------------------------------------------------------------ | ---------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `src/libs/Statistics/events.ts`                                                            | per **drink-timestamp**            | **hottest** | optimized here (candidate c)                                                      |
| `src/libs/Statistics/sessionCounts.ts`                                                     | `formatInTimeZone` per **session** | warm        | same module; a _second_ tz pass over the same data                                |
| `src/hooks/useLazyMarkedDates.ts`                                                          | `toZonedTime` per **session**      | warm        | powers the **Day Overview** + home calendar; over the loaded range (can be years) |
| `src/libs/DrinkingSessionUtils.ts` `isDifferentDay`                                        | 2× `formatInTimeZone`              | cold        | one caller (Session Timezone settings screen), per-render                         |
| `src/libs/DateUtils.ts` (`getLocalizedDateTime`, `getLocalizedDay`, `getZoneAbbreviation`) | `formatInTimeZone` wrappers        | cold-each   | single value per render, but widely used                                          |
| `src/screens/Badges/BadgesContent.tsx`                                                     | `formatInTimeZone` in a `useMemo`  | cold        | once per mount                                                                    |

Notable: `useLazyMarkedDates` was **already** hand-optimized for the same class
of problem — its comment notes date-fns `format` is "~100× slower" on Hermes and
dominated the day-overview mount ("77 months ≈ 2.3k `format` calls ≈ ~460 ms"),
so they replaced it with raw `Date` getters. The remaining `toZonedTime`
per-session call is the analogous next step.

### Recommendation: extract a shared timezone resolver

`sessionCounts.ts` and `useLazyMarkedDates.ts` only need _"given (ts, tz) → local
day key"_ — exactly what candidate (c)'s offset table provides. A shared resolver
(e.g. `@libs/Statistics/localTime` or a `DateUtils` helper) would be a DRY win
_and_ a perf win across both Statistics and Day Overview, and would also fix the
date-fns spring-forward bug in those paths. Sketch of the call-site change:

```ts
// sessionCounts.ts — today
dateKey = formatInTimeZone(startMs, sessionTz, 'yyyy-MM-dd'); // 1 Intl / session
// with a shared resolver
dateKey = resolver.dayKey(startMs, sessionTz); // pure arithmetic
```

```ts
// useLazyMarkedDates.ts — today
const sessionDate = toZonedTime(session.start_time, tz); // 1 Intl / session
const dayKey = toDateKey(sessionDate);
// with a shared resolver
const dayKey = resolver.dayKey(session.start_time, tz);
```

These are **per-session** (fewer items than per-drink-timestamp), so the absolute
win is smaller than in `events.ts`, but it removes a second full timezone pass
over the same data and unifies the (now bug-free) logic. Prototyped in
`scripts/perf/statsCandidates.ts` (`offsetSecondsAt` / `partsFromOffset` /
offset-table are the reusable primitives); migrating the two shipped call sites
is left as a contained follow-up to keep this change's blast radius on `events.ts`
alone (`useLazyMarkedDates` is a React-Compiler-sensitive hook).

---

## 6. Recommendation

**Keep the baseline; do NOT ship candidate (c).** Device testing (see the box in
the header) showed (c) is ~3.5× _slower_ on Hermes. `events.ts` has been reverted
to the baseline on this branch. The already-landed 5→1 `formatInTimeZone` fix
captured the real win (~5×); the baseline is near-optimal for any approach that
calls `Intl` per timestamp. This branch/PR keeps the benchmark harness, candidate
code, and correctness suite as an investigation record — no `events.ts` change
ships.

What this investigation establishes for the next round:

- **On Hermes, the metric that matters is the _number_ of `Intl` calls** (~2–3 ms
  each). Any "optimization" that adds `Intl` setup cost — even cost that is free
  on V8 — can regress. Profile call _count_, and always confirm on device.
- **`buildDrinkEvents` (1039 ms) is not the biggest cold-open cost — the "chart
  bundle parsed" step is ~2000 ms** on both builds (lazy-loading the charting
  library). That is the larger lever.
- A genuine further win in `buildDrinkEvents` requires **removing `Intl` from the
  cold path entirely**, not a faster `Intl` strategy.

**Next steps (each its own session):**

1. **Chart bundle (~2 s).** Investigate the ~2000 ms "chart bundle parsed" gate —
   the single biggest cold-open cost. Likely code-split / lazy-load or lighten
   the charting library (Skia / victory-native).
2. **Persist precomputed local fields.** Compute `localDay` / `localHour` /
   `localIsoWeek` / `localDow` once when a drink is logged (a single `Intl` call
   at write time, when the user is already interacting) and store them on the
   record, so `buildDrinkEvents` does **zero `Intl`** on cold open — eliminating
   the 1039 ms. Feasibility: high (pure function of sessions + prefs); the cost is
   a migration/backfill for existing drinks + a small write-path change. This is
   the real `events.ts` win.

**Other follow-ups:**

3. The date-fns-tz spring-forward off-by-one (§4) is real regardless — audit
   remaining `formatInTimeZone` call sites (`sessionCounts.ts`,
   `useLazyMarkedDates.ts`, `DateUtils`) (§5). A shared `Intl`-based day-key
   resolver fixes correctness, but note the Hermes lesson: keep it to **one**
   `Intl` call per item, no table build.
4. Remove the dev-only profiler (`src/libs/Statistics/profiling.ts`) once the
   Statistics load is acceptable on device.

Status on this branch:

- `src/libs/Statistics/events.ts` — **reverted to baseline** (no change ships).
- `__tests__/unit/libs/Statistics/events.test.ts` — **29/29 pass**.
- `__tests__/unit/libs/Statistics/eventsCandidates.test.ts` — investigation suite,
  **30/30 pass** (candidates a/b/c all match the oracle; (c) is correct, just slow
  on device).
- `scripts/perf/` — reproducible benchmark + profiler harness (dev-only).
