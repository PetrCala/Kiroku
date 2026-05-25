# Mockup B — Apple-Health-style hero metric

Promotes **one** supportive number to hero status (alcohol-free days), demotes the rest. Inspired by Apple Health's Activity ring summary and Daylio's "mood streak" framing.

**Hierarchy (top → bottom):**
1. **Hero card** — branded gradient block. Giant "14 / 25 days" number, eyebrow label, one warm sentence, six-month mini-sparkline. This is the only thing visible above the fold.
2. Three compact **secondary chips** in one row — sessions, units, avg.
3. Calendar heatmap card.
4. 8-week trend with band-of-normal.
5. Reassuring footer.

**Why hoist one metric:** §3 says "additive framing, weekly default, no shame triggers." A grid of four equally-weighted numbers tells the user *here are your statistics*. A single hero number tells them *here's the version of yourself we want to mirror back*. The other numbers exist for users who want detail, not as the front door.

**Trade-offs**
- Forfeits the symmetric "dashboard" density of mockup A. Power users may want to glance at all numbers at once without scrolling.
- Picks a single hero — if that hero metric is wrong for a user (e.g. someone whose goal is "fewer big sessions" rather than "more dry days"), the screen feels off. Without preferences, this is a one-size-fits-most choice.
- The mini-sparkline implies a multi-month window. Today the data layer only goes 3 months back by default (CONST.SESSIONS_INITIAL_FETCH_MONTHS) — would need a widen on screen mount, or shrink the spark to "last 4 weeks."

**Sample data:** same as Mockup A (14 alcohol-free days, 2 sessions, 8 units, 3.4 avg, etc.)
