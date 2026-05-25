# Mockup C — Calendar-first (Daylio / I Am Sober inspiration)

The month grid **is** the hero. KPIs live underneath the grid, attached to the same month. A small "This week" strip sits below for recent-context, and the 8-week trend lives at the bottom of the screen, deemphasized.

**Hierarchy (top → bottom):**
1. Month navigation (‹ May 2026 ›) — sets the implicit time frame for everything above the trend.
2. **Big monthly calendar heatmap** — bigger cells than mockup A (~44pt tap targets), each day labeled. Today is ringed. Alcohol-free days get a subtle green dot so the eye reads "quiet days" as a positive pattern, not "missing data."
3. Inline 3-stat summary glued to the bottom of the calendar card (alcohol-free days · sessions · avg units). KPIs are *part of* the calendar's story, not a separate widget.
4. "This week" strip — 7 day-pills (Mon→Sun, today ringed). Right below it: 2 sessions · 8 units · 5 quiet days.
5. 8-week trend with band, deemphasized at the bottom.
6. Reassuring footer.

**Why calendar-first**
- The user's mental model of "their drinking" is calendrical — they think *I went out on the 22nd*, not *I had units-per-session of 3.4*. Putting the grid first matches the model.
- Daylio's calendar-first design has been the dominant mood/habit-tracker pattern for a decade. It's what users coming from Daylio, I Am Sober, or Sober Time will recognize.
- The "alcohol-free dot" on quiet days is the most directly additive visual on the screen — quiet days literally *light up* with their own color.

**Trade-offs**
- The biggest, brightest visual on the screen is colored cells for *drinking days*. Even with yellow/orange (not red), that flips the §3 "additive framing" the other way: the eye finds drinks first, then quiet days as ambient. The green dot is a counter-weight, but it's subtle.
- 31 small clickable cells is a lot of tap targets without a drill-down to spend them on. v1 has no day-detail screen, so taps are dead — see DIRECTION_REVIEW.md for the recommendation.
- Loses the symmetric "four equal KPIs" idea entirely. Two of the four PR KPIs (avg/session, total units) move to subordinate positions; one (total units) gets demoted into the "this week" strip.
