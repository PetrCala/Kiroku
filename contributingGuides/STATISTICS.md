# Statistics — Design & Scaffolding

> **This doc describes the v1 design that was retired before shipping. The Statistics feature shipped instead as v2 — see [STATISTICS_V2.md](./STATISTICS_V2.md). Sections **§3 (tone)**, **§4 (library)**, **§5 (data principles)**, and **§10 (prior-attempt autopsy)** of this v1 doc remain in force and are inherited by v2; **§7 (concrete v1 surface)** and **§8 (phased rollout)** were superseded.**

---

Status: **design, pre-implementation**
Owner: TBD
Last updated: 2026-05-22

This document is the scaffolding plan for the statistics feature. It locks decisions that touch the whole feature (library, IA, data flow, tone) so individual implementation PRs can stay small and local. **Code lands behind the IA and primitives this document defines — nothing else.**

A prior attempt lives on `origin/feat/graphs` (Sept 2025). It built a sound data pipeline but never shipped a chart because no rendering library was ever picked. See [autopsy summary in §10](#10-prior-attempt-what-we-keep-and-what-we-discard). We start over from this document.

---

## 1. Goals & non-goals

**v1 goal**: ship a single "Statistics" screen — a summary-card hub showing the user **their own** drinking data, framed supportively, with a calendar heatmap and a weekly trend. Prove the scaffolding.

**v1 non-goals** (explicitly deferred):

- Drill-down screens / per-metric detail with D/W/M/6M/Y toggles (Tier 2)
- Cross-user comparison, friend leaderboards, cohort stats
- Server-side rollups in kiroku-api
- Web rendering — web shows a "view on mobile" placeholder until we add a parallel chart layer
- Streaks tied to consumption thresholds, achievement badges, push-notification stat summaries
- "Year in Review" / Spotify-Wrapped-style narrative (deferred to v1.x)
- BAC, body-weight-normalized stats (data integrity not yet sufficient)

---

## 2. Information architecture

We follow the canonical mobile-health three-tier pattern (Apple Health → Strava → Daylio) but only build **Tier 1** in v1.

```
Tier 1  Statistics hub                       ← v1 ships this
        ├─ KPI summary cards (pinnable)
        ├─ Calendar heatmap (current month)
        └─ Weekly trend (last 8 weeks)

Tier 2  Per-metric detail                    ← v2
        ├─ D/W/M/6M/Y segmented control
        ├─ Scrubbable chart with haptic ticks
        ├─ "Compare to previous period" overlay
        └─ "About this metric" explainer

Tier 3  Data point drill-down                ← v2.x
        └─ Tap a bar/day → list of that day's sessions
```

**Entry point**: a new tab or a Settings/Profile entry — TBD with navigation pass. The screen lives at `src/screens/Statistics/StatisticsScreen.tsx`. Route added to `ROUTES.ts` and `SCREENS.ts`.

---

## 3. Tone & framing principles (load-bearing)

Drinking is a sensitive domain. Research on alcohol-tracking apps (PMC, Tandfonline) shows progress measures **motivate when goals are met but trigger shame when missed**. Design constraints follow:

- **Additive framing** by default. Lead with "alcohol-free days this month," "drinks vs your average," "money saved" — same data, supportive verb. Avoid "you drank X" as a hero number.
- **Weekly default**, not daily. Single bad days disappear into trends. Daily granularity exists only in calendar heatmap form, where one cell is one of many.
- **Self-vs-past-self only in v1.** No external "good/bad" thresholds, no clinical guidelines, no friends. Comparison is to the user's own rolling baseline.
- **Band of normal, not target line.** Whoop-style: a translucent grey band of the user's 21-day rolling range; today plotted inside or outside it. Zero judgment.
- **No red colors for high days.** Use the existing `units_to_colors` palette (yellow/orange) — neutral, already in `Preferences`.
- **No streak-breaking visuals.** Streaks that visibly snap are shame engines. If we surface streaks, they're additive (alcohol-free days, mindful weeks).
- **Empty / sparse data shows reassuring copy**, not "no data."

A future `private_stats_mode` preference can hide numbers entirely for users in a vulnerable phase, with data still logged. Out of v1 scope but noted.

---

## 4. Library decision

**Pick**: [Victory Native XL](https://github.com/FormidableLabs/victory-native-xl) (v41.x, Skia-rendered, render-prop API) for line/bar/area charts.
**Custom Skia**: [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/) for the calendar heatmap (no mainstream RN library ships one).

**Why**:

- Render-prop API (`<CartesianChart>{({ points }) => …}`) is the only mainstream library whose ergonomics match Kiroku's compositional philosophy. We wrap it once in `BaseChart` and never expose Victory's props upward.
- Skia + Reanimated + Gesture Handler are dependencies the app already carries.
- 60 FPS even with months of session data; strict TypeScript.
- Actively maintained by Nearform in 2026.

**What we accept**:

- **No web rendering.** Web shows a placeholder for v1. A future Recharts-on-web layer can sit behind the same component interface.
- **A11y is manual.** Skia draws to canvas — there are no native a11y nodes. We overlay invisible labelled `View`s per data point. Tracked as a per-chart checklist item.
- **Calendar heatmap is hand-rolled** in ~150 LOC of Skia (path/rect drawing). Worth it; the primitive is reusable for any future custom chart.

Libraries explicitly rejected: `react-native-chart-kit` (abandoned), `react-native-graph` (line-only), `react-native-gifted-charts` (SVG-based, prop-heavy, weaker composability), `recharts` (web-only).

---

## 5. Data layer

All v1 stats are **computed client-side** from data already in Onyx. No new Onyx keys. No new API endpoints. No persisted rollups.

### 5.1 Module layout

```
src/libs/Statistics/
  types.ts              // DayRollup, WeekRollup, KpiValue, HeatmapCell, …
  sdu.ts                // gramsOfAlcohol, sduFrom — reused from feat/graphs
  rollups.ts            // pure: buildDayRollups(sessions, drinks_to_units, tz, range)
  selectors/
    kpis.ts             // (rollups) → KpiValue[]
    calendarHeatmap.ts  // (rollups, monthStart) → HeatmapCell[]
    weeklyBars.ts       // (rollups, weeks) → WeeklyBar[]
  index.ts
```

**Invariants**:

- All selectors are **pure functions**. Timezone is passed as an argument, never read from a module-mutable global (this was a `feat/graphs` defect).
- All time bucketing uses `date-fns` (`getISOWeek`, `startOfWeek` with `Preferences.first_day_of_week`, `formatInTimeZone`). No hand-rolled week-number math.
- Rollups iterate over **session structure**, not a flattened drink list. The prior branch's `transformDrinkingSessionsToDrinksList` collapses per-drink timestamps to `session.start_time` and is **not** used.
- Selectors are memoized on `(sessionsByDay hash, drinks_to_units hash, timezone, range)`.

### 5.2 Hooks layer

```
src/hooks/useStatistics/
  useStatisticsRollups.ts   // Onyx connect + buildDayRollups, memoized
  useKpis.ts
  useCalendarHeatmap.ts
  useWeeklyBars.ts
  index.ts
```

Hooks compose the Onyx subscription with the relevant selector. Screen-level components never call selectors directly — they call hooks.

### 5.3 Pagination & "all-time"

The session listener subscribes from `startOfMonth(subMonths(now, sessionsMonthsBack))` where the default is **3 months** (`CONST.SESSIONS_INITIAL_FETCH_MONTHS`). For v1:

- KPI cards default to **rolling 30 days** and **this calendar month** — safely within the 3-month window.
- Weekly bars show **last 8 weeks** — safely within.
- Calendar heatmap shows **current month**, navigable to previous months which triggers a window widen (existing pagination via `SESSIONS_CALENDAR_MONTHS_BY_USER_ID`).
- Anything claiming "all-time" must read `UserData.earliest_session_at` and **widen the listener window** before computing, then wait for `isFetchingOlderMonths` to clear. v1 has no all-time metric.

### 5.4 Data-integrity rules (defensive defaults)

| Condition                                                | v1 rule                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `session.end_time` missing                               | Excluded from average-duration KPI; included in count/units     |
| `session.ongoing === true`                               | Excluded from all historical stats                              |
| `session.drinks` empty/missing                           | Counted as a session, contributes 0 units                       |
| `session.blackout === undefined`                         | Treated as `false` for filters; show "—" not "0" if asked       |
| `session.timezone` missing                               | Fall back to viewer's timezone (current `DateUtils` convention) |
| `Preferences.drinks_to_units` undefined (during hydrate) | Stats screen shows skeletons until preferences load             |
| Zero sessions in window                                  | Show reassuring empty state per §3                              |

---

## 6. Component scaffolding

The goal is to mirror how `Text`, `MenuItem`, `List` are designed: **small primitives, label-driven, theme-aware, low API surface, composable**. No chart-specific props leak up.

### 6.1 Module layout

```
src/components/Charts/
  BaseChart/
    BaseChart.tsx         // Victory wrapper: theme integration, padding, axis defaults
    useChartTheme.ts      // pulls colors from ThemeContext
    types.ts              // ChartDatum, ChartRange, ChartTheme
  CalendarHeatmap/
    CalendarHeatmap.tsx   // Skia-drawn, accepts HeatmapCell[]
  WeeklyBars/
    WeeklyBars.tsx        // Victory CartesianChart wrapper
  TrendLine/
    TrendLine.tsx         // (deferred, scaffolded interface only in v1)
  ChartCard/
    ChartCard.tsx         // shell: title, optional subtitle, chart slot, footer
  KpiCard/
    KpiCard.tsx           // hero number + sparkline + delta chevron
    KpiCardGroup.tsx      // responsive grid of 3-up / 2-up cards
  Sparkline/
    Sparkline.tsx         // tiny line inside KpiCard
  index.ts
```

### 6.2 Component contracts (sketch)

```ts
// BaseChart — every Victory-rendered chart wraps this
type BaseChartProps = {
  data: ChartDatum[];
  range: ChartRange; // 'week' | 'month' | 'rolling30'
  emptyLabel?: string; // shown when data is empty
  accessibilityLabel: string; // required — a11y is not optional
  children?: (ctx: ChartRenderCtx) => ReactNode;
};

// ChartCard — the shell every chart sits in
type ChartCardProps = {
  title: string;
  subtitle?: string;
  footer?: ReactNode; // e.g. delta chip, period selector (v2)
  children: ReactNode; // the chart itself
};

// KpiCard — the summary tile
type KpiCardProps = {
  label: string; // "Alcohol-free days"
  value: string | number; // formatted hero value
  unit?: string; // "days", "drinks", "%"
  delta?: {value: number; direction: 'up' | 'down' | 'flat'; label: string};
  sparkline?: ChartDatum[]; // optional mini trend
  tone?: 'neutral' | 'supportive' | 'celebratory'; // §3
  onPress?: () => void; // wired to drill-down in Tier 2
};
```

Translation keys live under `translations.statistics.*`. Every label, unit, empty-state copy, and a11y string is translated. **No hardcoded strings in chart components.**

---

## 7. Concrete v1 surface

The Statistics screen renders, top to bottom:

1. **KPI card group** (3-up grid, swap to 2-up on narrow):
   - Alcohol-free days this month
   - Sessions this week (with vs-last-week delta)
   - Average units per session (rolling 30 days)
   - Total units this week (with vs-last-week delta)
2. **Calendar heatmap** — current month, color intensity ∝ units that day, tappable month-navigation, no drill-down to session list yet (scaffolds the interaction surface).
3. **Weekly bars** — last 8 weeks, units per week, with a faint horizontal band showing the user's 8-week rolling 25th–75th percentile (§3 "band of normal").
4. **Reassuring footer copy** when data is sparse.

That's it. No more in v1.

---

## 8. Phased rollout & how we parallelize

This is the work breakdown. Each phase ends shippable; later phases can be paused without leaving broken code. Items marked `[parallel]` can run as concurrent agent tasks against the same branch / stacked PRs.

### Phase A — Foundation (no UI)

- A1. Add Victory Native XL + ensure Skia is in `package.json`; bump if needed
- A2. `src/libs/Statistics/{types,sdu,rollups}.ts` + test suite (port from `feat/graphs`, fix the timestamp-collapsing & timezone defects called out in §5.1)
- A3. `src/libs/Statistics/selectors/{kpis,calendarHeatmap,weeklyBars}.ts` + tests
- A4. `src/hooks/useStatistics/*` — Onyx wiring + memoized selectors
- A5. Translation keys under `statistics.*` in `en.ts` and `cs_cz.ts`

A2/A3 `[parallel]`. A1 must land first because Victory needs to typecheck. A5 `[parallel]` with anything.

### Phase B — Primitives (no screen)

- B1. `Charts/BaseChart/*` — Victory wrapper + theme + a11y overlay pattern
- B2. `Charts/ChartCard/*` and `Charts/KpiCard/*` + `Sparkline`
- B3. `Charts/WeeklyBars/*` — composes BaseChart
- B4. `Charts/CalendarHeatmap/*` — direct Skia, ~150 LOC

B1 must land first. B2/B3/B4 `[parallel]` after B1.

### Phase C — Screen

- C1. `src/screens/Statistics/StatisticsScreen.tsx` — composes hooks + components
- C2. Route registration in `SCREENS.ts` / `ROUTES.ts`
- C3. Navigation entry (tab vs. Profile entry — decide in this PR)
- C4. Empty / loading / sparse-data states per §3 and §5.4
- C5. Manual QA on iOS, Android (and confirm web placeholder behavior)

C1–C4 land together in one PR. C5 is part of the same PR's checklist.

Optionally **Phase D — polish before declaring v1 done**: scrubbable tooltip with haptic ticks on `WeeklyBars`, "band of normal" overlay tuning, accessibility audit, screenshot test.

Each phase becomes one GitHub issue. Each issue maps to 1–4 PRs. Estimated total: 1.5–2 weeks of focused work.

---

## 9. What this scaffolding explicitly leaves room for (v2 hooks)

So we don't paint ourselves into corners:

- **Tier 2 detail screens**: `KpiCard.onPress` exists and is wired to a no-op in v1; v2 routes it to a detail screen using the same hook outputs.
- **D/W/M/6M/Y toggle**: `BaseChart.range` accepts a `ChartRange` union; v1 ships with one fixed value per chart; v2 makes it interactive.
- **Cross-user comparison**: selectors take `userID` (defaulting to current user). v2 passes a friend's `userID` and a server-supplied normalized rollup.
- **Persisted server rollups**: hooks read selector output today; v2 can switch the data source from `useStatisticsRollups` to a server-pinned Onyx key without touching the chart components.
- **Web parity**: `BaseChart` is the only file that imports Victory; a future `BaseChart.web.tsx` can swap in Recharts.

---

## 10. Prior attempt — what we keep and what we discard

Branch: `origin/feat/graphs` (Sept 2025). Tip is feature-gated off.

**Keep (port forward, with cleanups)**:

- `src/libs/Analytics/sdu.ts` — `gramsOfAlcohol`, `sduFrom`. Correct math; rename module to `src/libs/Statistics/sdu.ts`.
- `src/libs/Analytics/types.ts` — `DayRollup` shape is clean (userID + dateKey + totalSdu + drinksCount + byType).
- `__tests__/unit/libs/Analytics/rollups.test.ts` — 25 edge cases (invalid timestamps, NaN amounts, missing unit mappings). Reuse as the v1 spec.
- `calculateDrinksUnits` in `DrinkingSessionUtils.ts` — small reducer, keep.

**Discard / actively avoid**:

- `transformDrinkingSessionsToDrinksList` — collapses per-drink timestamps to `session.start_time`; **do not** use. Aggregate over the session structure directly.
- Module-level mutable `let timezone` in `Analytics/rollups.ts:13` — pass timezone explicitly.
- Hand-rolled `getWeekNumber` in `composition.ts` — collides at year boundaries. Use `date-fns` `getISOWeek` + `getISOWeekYear`.
- Stub chart components shipped without a rendering library — root cause of the abandonment. **No `<View><Text>{value}</Text></View>` placeholder charts in this iteration.**
- `@analytics/*` path alias — redundant with `@libs/Statistics/*`.

---

## 11. Open questions (resolve before Phase A starts)

1. **Navigation entry point** — new bottom-tab? Profile screen item? Decide with a quick design pass.
2. **First-day-of-week edge cases** — `Preferences.first_day_of_week` exists; confirm it's hydrated before stats compute.
3. **Earliest-session backfill** — `UserData.earliest_session_at` is documented as nullable for legacy users. Is there a backfill plan, or do we fall back to `getEarliestSessionStartTime` over loaded sessions in the meantime?
4. **Translation lift estimate** — `cs_cz.ts` parity expected from day one?

---

## 12. References

External UX patterns: Apple Health (D/W/M/6M/Y, scrubbable bars), Strava (compare date range, relative effort band), Whoop / Oura (band of normal), Daylio / I Am Sober (additive framing, year-in-pixels), GitHub / Streaks (calendar heatmap).

Library docs: [Victory Native XL](https://nearform.com/open-source/victory-native/docs/), [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/).

Research on alcohol-tracking app design: Tandfonline 2023 ("Patient perceptions of alcohol-tracking apps"), PMC 5434584 (Drinkaware Track & Calculate evaluation).
