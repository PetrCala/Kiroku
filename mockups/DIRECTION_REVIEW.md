# Statistics v1 — Direction Review

Companion to the visual mockups in `mockups/A_current_pr/`, `mockups/B_hero_metric/`, `mockups/C_calendar_first/`. Anchored to PR #519 on branch `feature/statistics`, design doc at `contributingGuides/STATISTICS.md`.

**TL;DR.** The PR's structure is *almost* right. Two design-doc commitments are missing in the code, one KPI is computed incorrectly enough that the hero number will mislead, one KPI is redundant with the chart below it, and one KPI (avg units / session) earns its slot the least. Recommended changes are localized — no IA rewrite, no library change, no v2 scope creep.

---

## 1. Is the hierarchy right?

**Verdict: yes, with one tweak.** Four equal KPIs + heatmap + bars is a legitimate Tier-1 IA (Apple Health Activity, Strava summary, Whoop overview all use a variant). It's denser than mockup B and less calendar-centric than mockup C, which matches §2's stated framing of "summary-card hub."

But the four KPIs render as four equal tiles in a 2×2 grid (`KpiCardGroup`), which makes them peers. The screen has no narrative — nothing tells the user *which* number they should walk away with. The doc itself implies there is one (§3: "Lead with 'alcohol-free days this month'..."), but the layout doesn't reflect that lead.

**Recommendation:** keep the four-KPI list, but render the first KPI (alcohol-free days) as a wider, slightly taller tile spanning the full row, with the remaining three in a 3-up row below. This is mockup B-lite — it preserves all four metrics but uses visual weight to honor §3's "lead with…" rule. Implementation lives entirely in [KpiCardGroup.tsx](src/components/Charts/KpiCard/KpiCardGroup.tsx) and is one PR.

If that's too much rework: at minimum, set `tone='celebratory'` on the alcohol-free KPI so its number renders in the success color (per [KpiCard.tsx:65](src/components/Charts/KpiCard/KpiCard.tsx) `accentColor` switch). That's a one-line change in [StatisticsScreen.tsx](src/screens/Statistics/StatisticsScreen.tsx) where `cards` is built.

## 2. Are these the right four KPIs?

| Slot | KPI | Earn its slot? | Notes |
|---|---|---|---|
| 1 | Alcohol-free days this month | **Yes — keep, but fix** | The hero per §3. See §3 below for the off-by-future-days bug. |
| 2 | Sessions this week (vs last week) | **Yes — keep** | Weekly cadence per §3. Delta is meaningful. |
| 3 | Avg units per session (rolling 30d) | **Weak — recommend swap** | Reads as a lab metric, has no delta, has no obvious supportive interpretation. "Down" could be a single quieter session in a heavy week. Replace with "Quiet days this week" (additive frame, has natural delta vs last week). |
| 4 | Total units this week (vs last week) | **Redundant — recommend drop** | This number *is* the last bar in the 8-week chart immediately below. Showing it twice spends a tile without adding information. Replace with "8-week trend" verb chip (see §5). |

The full proposed KPI set:

1. **Alcohol-free days this month** (hero, celebratory)
2. **Sessions this week** — with vs-last-week delta
3. **Quiet days this week** — with vs-last-week delta (NEW, replaces avg)
4. **Trend chip / "Inside your usual range" badge** (replaces total units)

The "inside your usual range" badge is just a textual readout of the band-of-normal — it's the same data the chart already computes (§7.3) surfaced as a sentence. This makes the band-of-normal legible without needing to interpret the chart, which today has no caption (§5 below).

If you want a 4th *number* tile rather than a chip: **"Sessions this month"** is the most directly informative — it pairs with "alcohol-free days this month" as a "month overview" duo, and never duplicates the chart.

## 3. Critical bug: alcohol-free days counts future days

[`selectKpis` in `src/libs/Statistics/selectors/kpis.ts:91-104`](src/libs/Statistics/selectors/kpis.ts) computes:

```ts
const daysInMonth = eachDayOfInterval({start: thisMonthStart, end: thisMonthEnd});
// ...
const alcoholFreeDaysThisMonth = daysInMonth.length - drinkDaysThisMonth;
```

This iterates the **entire** month, including future days. On May 1 with zero sessions, the hero KPI will read **31**. On May 25 (today) with 11 drinking days, it reads **20** even though only 14 of the elapsed 25 days have been alcohol-free. The number is consistently inflated by `daysRemainingInMonth`.

**This undermines the §3 tone constraint** — the screen will silently lie favorably, which is the failure mode users notice and lose trust over. Either:

- Clamp the interval to `min(thisMonthEnd, localAnchor)`, OR
- Re-label the KPI as "alcohol-free days remaining this month" with a different framing (probably worse — implies a quota).

Recommended fix: clamp the interval. Caption can stay "this month" because the number now matches lived time. Add a unit-test case.

## 4. Empty state

[`statistics.empty` in `src/languages/en.ts:831-834`](src/languages/en.ts):

```
title: 'Your stats will live here',
body:  'Log a session and your weekly trends, alcohol-free days, and monthly view will start to fill in.',
```

**This is the wrong default empty state.** A new Kiroku user who has not logged a session is, by the app's own framing, in a perfect alcohol-free state. The current copy treats them as missing data ("log a session and…") — i.e. nudges them to drink-then-log so the screen fills in. That's a directly anti-§3 motion.

Suggested rewrite:

```
title: 'Nothing to log yet — that counts.'
body:  'When you log a session, weekly trends and a monthly view will show up here. Until then, every day is a quiet one.'
```

Or split into two empty states: one for "never logged a session" (celebratory) and one for "no sessions in the current window" (additive — "X quiet days and counting"). [Statistics.ts hook layer](src/hooks/useStatistics/) already returns `isEmpty`; adding a `hasEverLoggedSession` distinction is a small selector change.

## 5. Two design-doc commitments not honored in the PR code

### 5.1 Missing reassuring footer

Design doc §7 step 4: *"Reassuring footer copy when data is sparse."*

The screen file ([StatisticsScreen.tsx](src/screens/Statistics/StatisticsScreen.tsx)) has no footer rendered in the non-empty branch. The `isEmpty` branch handles the all-empty case but the §7.4 footer is intended for *sparse* (not zero) data — e.g. "Only a few weeks of history yet — your trends will sharpen as you log more."

Either drop §7.4 from the doc, or add a `StatisticsScreen` footer block under the last `ChartCard` that renders when `weekly.data.bars.length < 4` or `kpis.data[0].value === 0`. Translation key needed.

### 5.2 Band-of-normal has no caption

The weekly bars render a translucent band per §3 "band of normal, not target line," which is the most §3-defining visual on the entire screen. The screen passes `band` to `WeeklyBars` but has no caption explaining what the band *is*. A user looking at the chart sees a yellow stripe and two bars and has no way to know that the stripe is "where most of your last 8 weeks land."

This makes the band do less work than it should. Add a one-line caption under the chart — keyed under `statistics.charts.weeklyBars.bandCaption`. Suggested copy: *"The shaded band is where most of your last 8 weeks landed."*

## 6. Tone & visual polarity issues

### 6.1 KpiCard delta colors assume polarity

[`KpiCard.tsx:73-78`](src/components/Charts/KpiCard/KpiCard.tsx):

```ts
if (delta && delta.direction === 'down') {
  deltaColor = theme.success;
} else if (delta && delta.direction === 'up') {
  deltaColor = theme.warning;
}
```

This hardcodes: down = good, up = bad. That's correct for sessions and units. But the moment any future KPI inverts (e.g. "quiet days," "alcohol-free streak"), `down` is bad and this color logic flips its meaning.

**Recommendation:** add an optional `polarity?: 'lower-is-supportive' | 'higher-is-supportive' | 'neutral'` (default `lower-is-supportive` so existing call sites don't change) and gate the color choice on it. This costs ~10 LOC and unblocks the §2 swap above ("quiet days this week" wants `higher-is-supportive`).

### 6.2 Heatmap cells for future days

The current `CalendarHeatmap` should render future days as visually distinct from "logged-but-quiet" days. If it doesn't, an empty-but-future May 31 cell looks identical to an empty-but-quiet May 4 cell — and the hero KPI will count the future cell as alcohol-free (§3). The mockups render future cells as transparent/dimmed; confirm `CalendarHeatmap.tsx` does the same. Easy unit-test target.

## 7. Things I'd add, remove, or swap before merge

**Add:**
- `polarity` prop on `KpiCard` (§6.1).
- Caption under `WeeklyBars` explaining the band (§5.2).
- Sparse-data footer in `StatisticsScreen` (§5.1).
- Two-state empty copy: "never logged" (celebratory) vs "nothing in window" (additive) — §4.
- Unit tests around month boundaries and future-day handling for alcohol-free days — §3.

**Fix:**
- Alcohol-free days clamped to elapsed days (§3). **This is the only must-fix-before-merge item.**

**Remove or swap:**
- Drop `avgUnitsPerSession` from the v1 KPI set. Replace with `quietDaysThisWeek` (§2).
- Drop `totalUnitsThisWeek` from the KPI set (redundant with chart). Replace with a "Sessions this month" tile, or with the band-of-normal verb chip (§2).

**Optionally consider for v1:**
- Promote alcohol-free days to a wider hero tile within the existing KPI grid (§1). This is the "mockup B-lite" path. Not a blocker — keep behind a follow-up.

## 8. Direction-check recommendation (single paragraph)

Stay with the PR's IA (KPI grid → heatmap → weekly bars), but tighten it: fix the alcohol-free days inflation bug, drop the two weakest KPIs (avg units, total units this week — one is clinical, the other duplicates the chart), and add the two missing design-doc commitments (band caption, sparse-data footer). Reframe the empty state so a new user reads as "quiet — that counts" instead of "missing data." If you want a single nudge toward a stronger v1 visual identity beyond those fixes, give the alcohol-free KPI a wider hero tile in the grid — that single layout move converts the screen from "dashboard" to "check-in" without changing the IA or the scope.

## 9. Open questions for the user

1. **`quietDaysThisWeek` selector** — easy to derive from rollups; OK to add as part of the §2 KPI swap, or keep this as a v1.x follow-up?
2. **Sessions-this-month** as the 4th KPI — does that pair as cleanly with alcohol-free days as it seems on paper, or does it re-introduce the "you drank X" framing §3 warns against (just on a monthly cadence)?
3. **Calendar tap targets** — design doc §7.2 says heatmap is "tappable month-navigation, no drill-down to session list yet (scaffolds the interaction surface)." Mockup C makes those tap targets prominent. For v1, should taps on individual days be visually suppressed (no press feedback) so users don't try them, or surfaced as a dead-but-promised interaction? My instinct is to suppress until Tier 2 exists.
4. **Sparse-data footer copy** — does this want a translation pass before merge, or ship in EN and follow with `cs_cz.ts` (§11 of the doc raises this)?
