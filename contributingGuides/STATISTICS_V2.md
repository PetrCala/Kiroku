# Statistics — v2 direction (supersedes STATISTICS.md §7)

Status: **shipped 2026-05-26 — epic #576**
Last updated: 2026-05-25
Authors: design conversation summarised from `mockups/DIRECTION_REVIEW.md` + the §9 fork resolutions

This document supersedes §7 ("Concrete v1 surface") and §8 ("Phased rollout") of `contributingGuides/STATISTICS.md`. All other sections of the existing doc — especially **§3 (Tone & framing principles, load-bearing)**, §4 (library decision), §5 (data layer principles), §10 (`feat/graphs` autopsy) — still apply unchanged.

The mockups that visualise the four-tab direction are in `mockups/C_calendar_first/` (calendar-first hero pattern, applied to a single tab) and `mockups/DIRECTION_REVIEW.md` (the audit that prompted this rewrite).

---

## 1. What changed

The original §7 plan was a single-screen hub with 4 KPIs + heatmap + 8-week bars. That ships a usable Tier-1 surface, but:

- It hard-codes the metric set in selectors — adding a new chart means a new selector.
- The data layer collapses to day-rollups, losing per-drink timestamp resolution (hour-of-day, drink-pacing-within-session both lost).
- The screen has no filter surface (drink-type, time-range, comparison toggles), and the selectors are not parameterised on user, so multi-user becomes a refactor not a feature toggle.

The v2 direction is **four tabs over one declarative data primitive**: every chart on every tab reduces over the same `DrinkEvent` event stream via composable bucketers, reducers, and filters. The screen layer becomes thin presentation; the data layer becomes a tiny query engine.

---

## 2. Locked decisions (the §9 forks)

| #   | Decision                             | Choice                                                                                                                                                                           |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Per-drink `volume_ml` + `abv` fields | **Both, optional.** Prefilled from a hardcoded `CONST.DRINK_DEFAULTS` table; user can override per drink event. `drinks_to_units` stays as fallback when either field is absent. |
| 2   | Multi-user scope                     | **Build the primitive; ship self-only in v1.** Every selector signature takes `userIds: UserID[]` (default `[currentUserID]`); UI only renders self until v2.                    |
| 3   | Statistical sophistication           | **EWMA (λ ≈ 0.3) + percentile band-of-normal visible. Mann–Kendall used _invisibly_ to gate copy. Change-point detection deferred.** Test result never displayed as a number.    |
| 4   | Screen structure                     | **Four tabs from day one** — Overview / Trends / Patterns / Breakdown. Empty-tab risk accepted in exchange for the Strava-feel and incremental tab-by-tab development cadence.   |
| 5   | Goal field                           | **No goal field.** Stay entirely on personal-baseline rails. Band-of-normal is the only target-like construct.                                                                   |

Sub-decisions inherited from those:

- Drink defaults are hardcoded for v1 (`beer: 500ml @ 5%`, `wine: 150ml @ 12%`, `cocktail: 250ml @ 10%`, `strong_shot: 40ml @ 40%`, `weak_shot: 40ml @ 20%`, `small_beer: 330ml @ 5%`, `other: 200ml @ 10%`). User-overridable defaults table moves to Preferences in v1.x.
- The DrinkEvent stream is **computed**, not persisted. Memoised over Onyx deltas, lives in memory only. No new Onyx collection, no write-amplification surface.
- Tab order is the listed order. Overview first (universal), Patterns before Breakdown (universally interesting > composition).

---

## 3. Data model additions

### 3.1 Drink event shape (optional fields)

The existing `DrinksList = Record<DrinksTimestamp, Drinks>` and `Drinks = Partial<Record<DrinkKey, number>>` cannot carry per-event metadata without a shape change. v2 introduces an extended-drink form:

```ts
// Backwards-compatible: existing Drinks entries (a number per key) keep working.
type DrinkEntry =
  | number // legacy: just a count
  | {
      count: number;
      volume_ml?: number; // optional override
      abv?: number; // optional override (0..1, fractional)
    };

type DrinksV2 = Partial<Record<DrinkKey, DrinkEntry>>;
type DrinksList = Record<DrinksTimestamp, DrinksV2>;
```

Migration: a one-shot Onyx upgrade hydrates legacy numeric values into `{count: N}`. SDU math reads `volume_ml ?? DRINK_DEFAULTS[key].ml` and `abv ?? DRINK_DEFAULTS[key].abv`.

### 3.2 Drink-add UI

The existing drink-add modal grows two optional fields ("Volume" and "ABV") behind a small "Adjust" disclosure. Defaults prefilled from `DRINK_DEFAULTS`. No required UX change for users who don't engage with the disclosure.

### 3.3 Defaults table

```ts
CONST.DRINK_DEFAULTS = {
  small_beer: {ml: 330, abv: 0.05},
  beer: {ml: 500, abv: 0.05},
  wine: {ml: 150, abv: 0.12},
  cocktail: {ml: 250, abv: 0.1},
  strong_shot: {ml: 40, abv: 0.4},
  weak_shot: {ml: 40, abv: 0.2},
  other: {ml: 200, abv: 0.1},
};
```

Locale-aware defaults (UK beer ≠ US beer) defer to v1.x as a Preferences-level override.

---

## 4. The DrinkEvent primitive

### 4.1 Canonical event shape

```ts
type DrinkEvent = {
  userId: UserID;
  sessionId: string;
  ts: number; // ms, per-drink (not collapsed to session.start_time)
  localDay: string; // 'yyyy-MM-dd' in session timezone
  localIsoWeek: string; // 'yyyy-Www'
  localMonth: string; // 'yyyy-MM'
  localHour: number; // 0..23
  localDow: number; // 0..6 (honors Preferences.first_day_of_week)
  drinkKey: DrinkKey;
  count: number;
  units: number; // count × drinks_to_units[drinkKey]
  sdu?: number; // when volume_ml + abv are present
  blackoutSession: boolean;
  sessionDurationMin?: number; // (end_time - start_time)/60000 when both present
};
```

Computed in one pass from `(sessions, drinks_to_units, drink_defaults, timezone, first_day_of_week)` and memoised on `(sessionsByDayHash, drinksToUnitsHash, timezone, weekStart)`.

### 4.2 Bucketer / reducer / filter contract

```ts
type Bucketer<TKey> = (e: DrinkEvent) => TKey;
type Reducer<TKey, TAgg> = (events: DrinkEvent[]) => TAgg;
type EventFilter = (e: DrinkEvent) => boolean;

function aggregate<TKey, TAgg>(
  events: DrinkEvent[],
  bucketer: Bucketer<TKey>,
  reducer: Reducer<TKey, TAgg>,
  filter?: EventFilter,
): Map<TKey, TAgg>;
```

Bucketers (in `@libs/Statistics/bucketers`):

- `byHour`, `byDow`, `byDay`, `byIsoWeek`, `byMonth`, `byQuarter`, `byYear`
- `byDrinkKey`, `byBlackout`, `byUserId`
- `composeBuckets(b1, b2)` → `(e) => [b1(e), b2(e)] as const`

Reducers (in `@libs/Statistics/reducers`):

- `sumUnits`, `sumSdu`, `countEvents`, `countSessions`, `countDays`
- `meanUnits`, `medianUnits`, `p25`, `p75`, `p90`, `stddev`
- `firstEvent`, `lastEvent` (for streaks)

Filters (in `@libs/Statistics/filters`):

- `dateRange(start, end)`, `drinkTypeSubset(keys)`, `weekendsOnly`, `weekdaysOnly`, `excludeBlackouts`, `forUsers(ids)`

### 4.3 What dies, what lives, from PR #519

| #519 surface                                                         | Fate in v2                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/libs/Statistics/sdu.ts`                                         | **Lives.** Reachable now via volume + abv.                                                                                               |
| `src/libs/Statistics/types.ts`                                       | **Lives, extended.** `DrinkEvent` added; `DayRollup` becomes a _derived_ type from `aggregate(events, byDay, sumUnits)`.                 |
| `src/libs/Statistics/rollups.ts` (`buildDayRollups`)                 | **Dies.** Replaced by `buildDrinkEvents(sessions, …)` + `aggregate(events, byDay, …)`.                                                   |
| `src/libs/Statistics/selectors/{kpis,calendarHeatmap,weeklyBars}.ts` | **Dies as files.** The KPI bug from `DIRECTION_REVIEW.md §3` lives on this file. New KPIs become one-line compositions of the primitive. |
| `src/hooks/useStatistics/*`                                          | **Rewritten thin.** Becomes a single `useDrinkEvents(userIds)` + per-chart `useAggregate(bucketer, reducer, filter)` pair.               |
| `src/components/Charts/BaseChart/*`                                  | **Lives.** Victory wrapper is direction-agnostic.                                                                                        |
| `src/components/Charts/ChartCard/*`                                  | **Lives.** Shell is direction-agnostic.                                                                                                  |
| `src/components/Charts/KpiCard/*` + `Sparkline`                      | **Lives.** Add `polarity` prop per `DIRECTION_REVIEW.md §6.1`.                                                                           |
| `src/components/Charts/WeeklyBars/*`                                 | **Lives**, becomes one chart of many. Used in Trends tab; deprecated on Overview if the trend line replaces it.                          |
| `src/components/Charts/CalendarHeatmap/*`                            | **Lives.** Used in Overview tab; will gain drill-down in v1.                                                                             |
| `src/screens/Statistics/StatisticsScreen.tsx`                        | **Dies.** Replaced by a 4-tab navigator with one screen per tab.                                                                         |
| `statistics.*` translation keys                                      | **Lives, extended.** Tab labels, new chart titles, EWMA/band captions, sparse-data footer copy added.                                    |

---

## 5. StatsContext (the shared filter surface)

```tsx
type StatsContextValue = {
  range: { start: Date; end: Date; preset: 'W' | 'M' | '6M' | 'Y' | 'All' | 'Custom' };
  setRange(...): void;
  comparison: 'none' | 'previous-period' | 'previous-year';
  setComparison(...): void;
  drinkTypeFilter: Set<DrinkKey>;          // empty = all
  setDrinkTypeFilter(...): void;
  userIds: UserID[];                       // [currentUserID] in v1
};
```

- Lives at the root of the Statistics tab navigator. All four tabs read from it.
- Switching tabs preserves filters (this is the move that makes the feature feel coherent).
- The shared toolbar (range segmented control + drink-type chip row + comparison toggle) renders as a sticky header above the tab content.

---

## 6. Tab-by-tab assignment (v1 contents)

Each tab ships with at least one **hero chart** so no tab feels empty on day one. Bullet items are v1; items in _italics_ are v1.x adds.

### 6.1 Overview — "How are you doing?"

- **Hero**: alcohol-free days this month, fixed for elapsed days per `DIRECTION_REVIEW.md §3`. Celebratory tone.
- KPI row: sessions this week (Δ), quiet days this week (Δ), units this week (Δ)
- This-month calendar heatmap (existing Skia component)
- 8-week mini trend line + band-of-normal (Whoop-style)
- "Inside / outside your usual range" verb chip (driven by Mann–Kendall on the visible window)
- Sparse-data footer copy when applicable

### 6.2 Trends — "How is this changing?"

- **Hero**: weekly units line + EWMA overlay + band-of-normal
- Cumulative alcohol-free days YTD (only-up line, psychologically additive)
- Weekly drink-type stacked area
- "vs previous period" toggle adds a dashed second series to each
- _Mann–Kendall caption gating_: "your weekly units are trending down" (when significant), else neutral copy

### 6.3 Patterns — "When and how do you drink?"

- **Hero**: hour-of-day polar chart (24 spokes), drink events bucketed by `localHour`
- Day-of-week × hour heatmap (7×24)
- Drinks-per-session histogram
- Session-duration histogram
- _ECDF of units-per-session_ — "70% of your sessions are ≤ 3 units"

### 6.4 Breakdown — "What do you drink?"

- **Hero**: drink-type donut (current `range`)
- Per-type weekly trend small-multiples (one mini line per drink type)
- Type-switching transitions (_Sankey-lite, defer if it bloats v1_)
- Type-concentration index → one-line copy: "you've been more varied this month than last"

---

## 7. Drill-down (cross-tab interaction)

Every tappable element on every chart lands on the same drill-down sheet: a list of contributing sessions filtered to the tapped bucket. Lives at `src/screens/Statistics/StatsDrillDownSheet.tsx`. The sheet's filter is built from the tapped bucket + the active `StatsContext`. Drill-downs are a v1 feature, not v2 — they're what makes the chart taps not feel dead.

---

## 8. Statistical sophistication — concrete rules

**EWMA**:

- λ = 0.3 default; can be config-tuned.
- Rendered as a thin solid line over the raw bars/line.
- Caption: "smoothed weekly average."

**Band-of-normal**:

- P25–P75 over the last min(window, 12) weeks.
- Rendered as a translucent fill.
- Caption per chart: "shaded band is where most of your last N weeks land."

**Mann–Kendall**:

- Computed over the visible time-series.
- `p < 0.05` AND `n >= 8` → caption gates open: "your weekly units are trending down/up."
- Otherwise caption stays neutral: "your weeks vary as usual."
- The numeric `tau` and `p` are **never displayed**.

**Change-point detection**: deferred. v2 candidate.

---

## 9. PR #519 disposition (recommendation)

**Retarget the existing PR** rather than land-then-redesign or close-and-rebranch.

Concrete amend plan (one follow-up commit on `feature/statistics`):

1. Delete `src/screens/Statistics/StatisticsScreen.tsx` and the route registration (the screen becomes the new tab navigator in a follow-up PR, not this one).
2. Delete `src/libs/Statistics/rollups.ts` (`buildDayRollups`), `src/libs/Statistics/selectors/*`, `src/hooks/useStatistics/use{Kpis,CalendarHeatmap,WeeklyBars}.ts`. These become v2 work.
3. Keep: Victory + Skia deps, `BaseChart`, `ChartCard`, `KpiCard`, `KpiCardGroup`, `Sparkline`, `WeeklyBars`, `CalendarHeatmap`, `sdu.ts`, `types.ts` (extended), the `statistics.*` translation namespace, and all chart-component tests.
4. Rename PR title to **"Statistics — foundation (chart primitives, deps, SDU math)"**, mark as "foundation only — no UI yet."
5. Update the PR description to point to this doc.

Effect: ~1500 lines of #519's 4005 land cleanly, every primitive becomes reusable, the doomed screen + selectors get reclaimed by v2 work.

If user objects to amending the existing PR, fallback is **close #519 and cherry-pick the kept files onto `feature/statistics-v2`**. Higher friction, same end state.

---

## 10. GitHub issue map

### 10.1 Existing issues — disposition

Epic **#498** ("Statistics feature — v1 (personal overview)") → **close** when foundation PR merges; replaced by new epic.

| Issue | Title (abbreviated)                          | Disposition                                                                |
| ----- | -------------------------------------------- | -------------------------------------------------------------------------- |
| #499  | Victory + Skia deps                          | Keep / land with foundation PR                                             |
| #500  | SDU math, types, day rollups                 | **Split**: SDU + types keep; `day rollups` portion closed (replaced by §4) |
| #501  | KPI / heatmap / weekly-bars selectors        | **Close** — selectors are replaced by `DrinkEvent` primitive               |
| #503  | useStatistics hooks                          | **Close** — hooks rewritten; new issue under v2                            |
| #504  | Translation keys                             | Keep / extend with new tab labels & chart captions                         |
| #505  | BaseChart primitive                          | Keep                                                                       |
| #506  | ChartCard, KpiCard, Sparkline                | Keep — add `polarity` prop                                                 |
| #507  | WeeklyBars chart                             | Keep                                                                       |
| #508  | CalendarHeatmap (Skia)                       | Keep                                                                       |
| #509  | StatisticsScreen + nav entry + empty/loading | **Close** — screen design replaced by tab shell                            |

### 10.2 New issues (v2 epic)

Proposed new epic **"Statistics v2 — four-tab feature over a declarative event-stream layer"** with these sub-issues:

| #    | Title                                                               | Notes                                                       |
| ---- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| v2-A | Add optional `volume_ml` + `abv` to drink data shape                | Onyx migration; SDU math becomes reachable                  |
| v2-B | Drink-add UI: optional "Adjust" disclosure for volume + ABV         | Defaults prefilled from CONST.DRINK_DEFAULTS                |
| v2-C | DrinkEvent stream + bucketer/reducer/filter primitive               | The core scaffolding (§4)                                   |
| v2-D | `useDrinkEvents` + `useAggregate` hooks                             | Replaces deleted #503 hooks                                 |
| v2-E | StatsContext + shared filter toolbar                                | Range, comparison, drink-type, userIds                      |
| v2-F | 4-tab navigator + tab-switching shell                               | Empty tabs OK on day one                                    |
| v2-G | Overview tab                                                        | Includes the existing heatmap + KpiCard + new trend mini    |
| v2-H | Trends tab                                                          | Weekly line + EWMA + band; cumulative AF days; stacked area |
| v2-I | Patterns tab                                                        | Polar hour-of-day; day×hour heatmap; histograms             |
| v2-J | Breakdown tab                                                       | Donut; per-type small-multiples; concentration copy         |
| v2-K | Drill-down sheet                                                    | Tappable on every chart                                     |
| v2-L | EWMA + Mann–Kendall + percentile utilities (pure functions + tests) | The math layer for §8                                       |
| v2-M | i18n + tone pass (English + cs_cz) for new tabs/captions            | Including DIRECTION_REVIEW.md §4 empty-state rewrite        |

12 issues. Each is one PR. Estimated 4–6 weeks of focused work; longer wall-clock with parallel sessions.

Dependencies: A→B, C→D→E→F→{G,H,I,J}, K depends on F, L feeds H & I, M trails behind G/H/I/J.

---

## 11. Sequencing & parallelisation

**Phase 0 (this work, immediate):** amend PR #519 per §9.
**Phase 1:** v2-A, v2-B, v2-C in parallel. (v2-A unlocks v2-B; v2-C is independent.)
**Phase 2:** v2-D, v2-E, v2-L in parallel after Phase 1 lands.
**Phase 3:** v2-F (shell) lands solo.
**Phase 4:** v2-G, v2-H, v2-I, v2-J in parallel — one spawned session per tab, each enters plan mode first.
**Phase 5:** v2-K (drill-down) + v2-M (i18n pass) lands as the close-out.

The four-tab Phase 4 is where parallel spawned sessions earn their keep — each tab is bounded, each has a clear "hero chart" target, each can hit the same scaffolding cold.

---

## 12. What's deferred to v2.x and beyond

- Change-point detection (§8)
- Multi-user UI (small-multiples for friends; aggregate group stats)
- Locale-aware drink defaults (Preferences-level override)
- Persisted server rollups (kiroku-api territory)
- Web parity (Recharts behind the same `BaseChart` interface)
- Mood / cost / companion / location data inputs (each unlocks a metric family)
- "Private stats mode" Preferences toggle
- Year-in-Review / Spotify-Wrapped narrative

---

## 13. Open questions deferred to per-issue plan mode

These don't block scaffolding; they get answered in the relevant sub-issue's plan-mode session:

1. **Onyx migration mechanic** for the Drinks shape change. (v2-A)
2. **Polar-chart rendering** — Skia direct draw or wrap Victory's radial? (v2-I)
3. **EWMA edge cases** — initialisation (mean of first 4 weeks?), gap handling. (v2-L)
4. **Drill-down navigation** — push a screen or a bottom-sheet? (v2-K)
5. **`Sankey-lite`** in Breakdown tab — ship in v1 or v1.x? (v2-J)

---

## 14. References

- `contributingGuides/STATISTICS.md` — the original design doc. §3 (tone), §4 (library), §5 (data principles), §10 (`feat/graphs` autopsy) remain in force.
- `mockups/DIRECTION_REVIEW.md` — the audit of PR #519's v1 surface that prompted this rewrite. Especially §3 (alcohol-free days bug), §5 (missing footer + band caption), §6 (polarity prop).
- `mockups/A_current_pr/`, `mockups/B_hero_metric/`, `mockups/C_calendar_first/` — visual mockups; C is the closest analog to the Overview tab's intended feel.
- PR [#519](https://github.com/PetrCala/Kiroku/pull/519) — the foundation PR being retargeted.
