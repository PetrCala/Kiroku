# Stats/calendar perf regression — repro + instrumentation

Diagnostic harness for the post-[#1414](https://github.com/PetrCala/Kiroku/pull/1414)
device-build regression: the home tap-latency win shipped, but **profile / friends
got slower** and the **infinite-scroll calendars stall on loading skeletons**.

> ⚠️ This branch is **diagnostic, not for merge.** It widens the Test Tools gate
> to non-production and adds verbose counters. The real fix lands in a separate
> PR once the data points at a cause; this branch then gets reverted/trimmed.

## What it measures

A dependency-free profiler (`src/libs/StatsPerf`) accumulates counters on the
Statistics/calendar hot paths and prints a compact `[StatsPerf]` line every ~2s
(console **and** a live readout inside Test Tools). Key counters:

| Counter                                              | Meaning                                                 | Points at                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `useDrinkEvents.effectFire`                          | times the deferred-rebuild effect ran                   | **loop** (⚠️LOOP flag when runaway)                                                                    |
| `useDrinkEvents.via.interaction` / `.via.backstop`   | which timer ran the rebuild                             | **interaction-queue starvation** (backstop-heavy ⇒ queue never settles ⇒ scroll-ready/skeleton stalls) |
| `backfill.merge` / `.sessions` / `.empty`            | `CACHED_DRINKING_SESSIONS` time-parts writes            | **backfill write loop** (non-converging patch)                                                         |
| `intl.probe`                                         | real `Intl.formatToParts` calls (~1-3ms each on Hermes) | **lost whole-history backfill** (spikes on profile/calendar)                                           |
| `bde.storedHit` / `bde.resolveFallback`              | stored-parts vs recompute on the read path              | backfill coverage                                                                                      |
| `buildDrinkEvents.{call,cacheHit,session,events,ms}` | event-stream walk volume + time                         | compute cost vs cache thrash                                                                           |
| `groupSessionsByMonth.{sessions,ms,calls}`           | calendar grouping pass                                  | calendar compute cost                                                                                  |

## Web first (fast triage)

A render/backfill **loop** is logic, so it reproduces identically on web — and
the counters are engine-agnostic, so the per-screen **volumes** (`intl.probe`,
`bde.resolveFallback`, `effectFire`, `backfill.merge`) are accurate there too. A
2-minute web pass settles the biggest question for free. What web _cannot_ show:
the actual Hermes _slowness_ (V8 `Intl` is ~1000× faster), the literal
stuck-skeleton rendering, and the `via.backstop` starvation signal — those need
the device build.

1. `npm run web` on this branch, sign into the test account (dev Firebase = the
   same hundreds of sessions). Instrumentation is on automatically (dev).
2. Watch the **browser console** for `[StatsPerf]` lines, or drive it from the
   console (`globalThis.statsPerfDebug`):
   - `statsPerfDebug.report()` → current readout lines
   - `statsPerfDebug.clear()` → reset counters between screens
   - `statsPerfDebug.compute('full' | 'window')`, `statsPerfDebug.backfill('full' | 'window')` → flip the A/B levers
   - `statsPerfDebug.open()` → pop the Test Tools panel
3. Or click the **⚡︎ Perf** button (bottom-left, web + non-prod only) to open
   the panel with the readout + levers.

## Build it (device — confirm timing + stuck behavior)

The _slowness_ is a Hermes/JS-thread effect a web/V8 preview can't reproduce. Use
a **release ad-hoc** build (instrumentation is gated on `ENVIRONMENT !== prod`,
so it is on for ad-hoc/staging/dev and off on the store build):

- The PR carries the **`Ready To Build - iOS`** label → CI publishes an ad-hoc
  IPA. Install it on the device with the test account (hundreds of sessions).
- On the ad-hoc (release) build, `console.*` is stripped — use the **in-app**
  Test Tools readout, not Console.app.

## Open the panel

Instrumentation logs by default on the ad-hoc build. To see the readout / flip
levers on-device (no Xcode needed): **four-finger tap** anywhere → Test Tools →
scroll to **StatsPerf diagnostics**.

## Procedure (attribution by clearing between screens)

The counters are global, so isolate each screen by clearing first:

1. Open Test Tools, tap **Clear StatsPerf counters**, close.
2. Cold-launch (or navigate to) **Home**. Reopen Test Tools, screenshot the readout.
3. Clear → open **Profile** (self) → reopen, screenshot.
4. Clear → open **Friends**, then a **friend's profile** → reopen, screenshot.
5. Clear → open the **fullscreen calendar**, scroll back a few months → reopen, screenshot.

Read the screenshots against the table above:

- A line marked **⚠️LOOP**, or `via.backstop` ≫ `via.interaction`, on a screen
  that stalls ⇒ JS-thread saturation / interaction-queue starvation (the
  stuck-skeleton mechanism).
- High `intl.probe` + high `bde.resolveFallback` on profile/calendar ⇒ the
  lost whole-history backfill (the "slower" mechanism).
- High `backfill.merge` that never drops to `backfill.empty` ⇒ a non-converging
  backfill write loop.

## Bisect the fix on the same build (no rebuild)

In Test Tools → StatsPerf diagnostics, two levers (persisted; default `window` =
current #1414 behaviour, `full` = pre-#1414):

- **Home compute scope** — `full` reverts #1414's event windowing.
- **Backfill scope** — `full` restores the whole-history time-parts backfill.

Test the four combinations and re-run the procedure for each:

| compute | backfill | expectation                                                        |
| ------- | -------- | ------------------------------------------------------------------ |
| window  | window   | current master (Home fast, others regressed)                       |
| window  | **full** | **leading fix**: Home stays fast, profile/friends/calendar recover |
| full    | full     | pre-#1414 (all fine, Home slow)                                    |
| full    | window   | diagnostic corner                                                  |

If `window`+`full` restores the other screens while keeping Home fast, the fix is
to keep the compute windowed but **deferred-backfill the full history** (off the
launch frame). That becomes the real PR.

## Where things live

- Profiler core (pure): `src/libs/StatsPerf/index.ts`
- Onyx/CONFIG wiring + flush + loop flag: `src/libs/StatsPerf/connect.ts` (init in `src/setup/index.ts`)
- Levers/toggle state: `NVP_STATS_PERF_DEBUG` Onyx key, `src/libs/actions/StatsPerfDebug.ts`
- Panel: `src/components/TestToolsModal/index.tsx` (gate widened in `src/components/ScreenWrapper.tsx`)
- Instrumented paths: `events.ts`, `localParts.ts`, `actions/Statistics.ts`, `useStatistics/useDrinkEvents.ts`, `useHomeStats.ts`, `SessionsCalendar/deriveCalendarMonth.ts`
