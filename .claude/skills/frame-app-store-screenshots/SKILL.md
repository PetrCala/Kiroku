---
name: frame-app-store-screenshots
description: Turn raw Kiroku app captures into App Store-ready marketing screenshots — real screenshot composited onto a branded gradient background with a caption, rendered at the exact pixel sizes App Store Connect requires (6.9" 1320×2868, 6.7" 1290×2796), per locale. Use whenever the user wants App Store screenshots, store images, marketing screenshots, "the images users see on the App Store", framed/captioned screenshots, to re-generate or restyle store screenshots, change a caption, add a locale, or change the screenshot background/theme. Trigger on indirect phrasing too — "make the store screenshots", "frame my screenshots", "App Store images", "screenshot captions", "regenerate the store shots". This is the sanctioned, deterministic way to produce store screenshots without the full fastlane snapshot pipeline; do not hand-edit the framed PNGs.
---

# Frame App Store Screenshots (Kiroku)

Driven by [`scripts/frame-app-store-screenshots.mjs`](../../../scripts/frame-app-store-screenshots.mjs),
configured by [`scripts/store-screenshots.config.mjs`](../../../scripts/store-screenshots.config.mjs).
Uses `sharp` + `text-to-svg` (the same deterministic stack as `generate-icons.mjs`) —
no headless browser and no generative image model, so output is pixel-perfect and
re-runnable in seconds.

## What this does (and the one hard rule)

It composites a **real app capture** onto a branded background with a caption, at
the exact sizes ASC requires. The marketing chrome (background, caption, rounded
corners, device sizing) is generated; **the screenshot content is your genuine
app capture and must never be fabricated** — Apple Guideline 2.3.3 requires
screenshots to depict the shipped app, and a reviewer comparing them to the build
will reject mismatches. If asked to "AI-generate the whole screenshot," push back
and explain this; only the background/caption layer is synthesized.

## Workflow

1. **Capture the real screens.** One PNG per shot, per locale, on an iPhone
   16/17 Pro Max simulator (source 1320×2868), signed in as the seeded reviewer
   account so calendar/stats aren't empty. Drop them in:

   ```
   fastlane/store-screenshots/raw/<locale>/<name>.png
   ```

   Filenames must match the `raw` fields in the config. (`raw/` and `framed/` are
   git-ignored — they're inputs/outputs, not source.)

2. **Confirm inputs:** `npm run frame-screenshots -- --check`

3. **Render:** `npm run frame-screenshots`

   - Scope with `--locale cs` and/or `--device 6.9` while iterating.
   - Output: `fastlane/store-screenshots/framed/<locale>/<device>/NN_<name>.png`,
     verified to be exactly the required dimensions before writing.

4. **Upload** `framed/**` to App Store Connect (manually for now; can be wired
   into `deliver` later — note ASC infers the device slot from image dimensions).

## Making changes

- **Captions / shot order / which shots:** edit the `shots` array in the config
  (captions are keyed by locale; keep them consistent with Kiroku's
  harm-reduction framing — never celebrate drinking _volume_).
- **Background, fonts, sizing, corner radius:** edit `theme` in the config.
- **Device sizes / locales:** edit `devices` / `locales` in the config. Sizes
  must stay exact App Store pixel dimensions.

Re-run after any change; the script wipes and rewrites each locale/device output
folder so removed shots don't linger. Missing captures are skipped with a warning
rather than failing the whole run.
