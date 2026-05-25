# Mockup A — Current PR direction

A faithful visual reading of what PR #519 will render today, based on the screen file at `src/screens/Statistics/StatisticsScreen.tsx` and design doc §7.

**Hierarchy (top → bottom):**
1. 2×2 KPI grid — alcohol-free days, sessions this week (delta), avg units/session, total units this week (delta).
2. Calendar heatmap card — current month, yellow→orange intensity ramp, today highlighted.
3. 8-week weekly bars card — yellow/orange bars with a translucent yellow "band of normal" (P25–P75 of the 8-week window), the current week subtly outlined.
4. Reassuring single-line footer.

**Sample data (anchored to 2026-05-25):**
- 14 alcohol-free days of 25 elapsed
- 2 sessions this week (▼ 1 fewer than last week)
- Avg 3.4 units/session rolling 30 days
- Total 8 units this week (flat vs last week)

**What this layout does well**
- All four hero numbers fit above the fold on a 390-wide device.
- Three distinct "views" of the same data (point KPI, monthly grid, weekly trend) at three time granularities — Strava-grade information density.
- Band-of-normal directly enforces design doc §3 ("no target line").

**What this layout makes you feel**
- Slightly clinical. Four numbers + two charts is a lot of *measurement* before the user gets to a single supportive sentence.
- The KPIs sit on the same visual tier, with no narrative spine — the screen reads like a dashboard, not a check-in.

Open `index.html` in any browser.
