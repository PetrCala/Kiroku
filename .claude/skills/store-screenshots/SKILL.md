---
name: store-screenshots
description: End-to-end pipeline for Kiroku's App Store / Play Store screenshots — capture real app screens, ingest, frame onto a branded gradient with a localized caption at the exact App Store Connect sizes (6.9" 1320×2868, 6.7" 1290×2796), then upload. Use whenever the user wants to create, change, regenerate, restyle, or re-caption store screenshots / marketing screenshots / "the images users see on the App Store" — change a caption, add a locale, swap which screen a shot shows, re-theme the background, or capture fresh app screens. Trigger on direct and indirect phrasing: "change the store screenshots", "regenerate the App Store images", "frame my screenshots", "update the screenshot captions", "new store screenshots", "capture app screenshots". Deterministic framing (sharp + text-to-svg); never hand-edit the framed PNGs or fabricate app UI (Apple Guideline 2.3.3).
---

# Store screenshots (Kiroku)

The single front door for App Store / Play Store screenshots. Four stages, wired
to share one manifest so they can never silently drift:

**capture → ingest → frame → upload**

- **Manifest (single source of truth):** [`scripts/store-screenshots.config.mjs`](../../../scripts/store-screenshots.config.mjs)
  — the shot list (each `{snapshot, raw, caption}`), locales, capture-locale map,
  source device, and visual theme. Change captions / shots / theme / locales here.
- **Capture** (real app screens): fastlane `snapshot`, run by the
  [`screenshots.yml`](../../../.github/workflows/screenshots.yml) CI workflow.
  Internals: [`contributingGuides/SCREENSHOTS.md`](../../../contributingGuides/SCREENSHOTS.md).
- **Ingest** (capture → framing inputs): [`scripts/ingest-store-screenshots.mjs`](../../../scripts/ingest-store-screenshots.mjs) → `npm run ingest-screenshots`.
- **Frame** (marketing chrome): [`scripts/frame-app-store-screenshots.mjs`](../../../scripts/frame-app-store-screenshots.mjs) → `npm run frame-screenshots`.

## The one hard rule (Apple Guideline 2.3.3)

Screenshots must depict the SHIPPED app. This pipeline only adds marketing chrome
(background + caption) around your genuine captures. Never fabricate or
AI-generate the app UI inside a screenshot — a reviewer comparing them to the
build will reject mismatches. If asked to "AI-generate the whole screenshot", push
back; only the background/caption layer is synthesized.

## Runbook

### 0. Prerequisite — the demo account needs an in-month session

Capture logs into the `APPLE_DEMO_*` account, and the Day Overview shot taps the
first calendar day that has a recorded session. **Before capturing, sign in to the
demo account and log at least one drinking session in the current calendar
month**, or the run fails ~40 min in on a missing `DayMarking`.

### 1. Capture (slow, uses CI minutes — only when the app UI changed)

```bash
gh workflow run screenshots.yml -f device_subset=all   # all | phone-only | ipad-only
gh run watch                                           # wait for the run
gh run download <run-id> -D /tmp/shots                 # grab the ios-screenshots-<sha> artifact
```

If only captions / theme / locales change (not the app screens), **skip capture**
and reuse the captures already in `raw/`.

### 2. Ingest — map captures into the framing inputs

```bash
npm run ingest-screenshots -- --from /tmp/shots/ios-screenshots-<sha> --check   # dry-run
npm run ingest-screenshots -- --from /tmp/shots/ios-screenshots-<sha>           # copy into raw/
```

Omit `--from` to ingest a local `fastlane/screenshots/ios` capture; the mapper
auto-descends into a nested `fastlane/screenshots/ios` subfolder if the artifact
still has one. It renames `01_Home.png → 01-home.png`, remaps `cs-CZ → cs`, reads
the `iPhone 17 Pro Max` master, and skips captures with no manifest entry (e.g.
`05_Settings`).

### 3. Frame — render the store-sized images

```bash
npm run frame-screenshots -- --check     # confirm raw inputs are present
npm run frame-screenshots                # → framed/<locale>/<device>/NN_*.png
```

Scope while iterating with `--locale cs` / `--device 6.9`. Each output is verified
to be exactly the required pixel size before it's written.

### 4. Upload to App Store Connect

Upload `fastlane/store-screenshots/framed/**` to ASC (manual for now — ASC infers
the device slot from the image dimensions). Wiring this into fastlane `deliver` is
a planned follow-up.

## Making changes

- **Captions / shot order / which screens shown:** edit the `shots` array in the
  config. English is authoritative; run the `translate` skill for non-English
  captions rather than hand-writing them. Keep Kiroku's harm-reduction framing —
  never celebrate drinking _volume_.
- **Background / fonts / sizing / corner radius:** edit `theme` in the config.
- **Locales / device sizes:** edit `locales` / `devices` (sizes must stay exact
  ASC dimensions); add the matching `captureLocales` entry for a new locale.
- **Which screens get captured** (add Statistics, an alcohol-free streak, etc.):
  edit the UI tests (`ios/KirokuUITests/ScreenshotTests.swift` and
  `android/app/src/androidTest/.../ScreenshotTest.kt`) and the `snapshot` fields in
  the config together, then re-capture. The config currently maps the 4 screens we
  already capture (Home, LiveSession, DayOverview, Profile); `05_Settings` is
  captured but intentionally unmapped.
