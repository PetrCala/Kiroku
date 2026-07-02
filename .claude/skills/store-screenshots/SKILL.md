---
name: store-screenshots
description: End-to-end pipeline for Kiroku's App Store + Google Play screenshots — capture real app screens (iOS + Android), ingest, frame onto a branded gradient with a localized caption at exact store sizes, then upload to App Store Connect / Play. Use whenever the user wants to create, change, regenerate, restyle, or re-caption store screenshots / marketing screenshots / "the images users see on the store" — change a caption, add a locale, swap which screen a shot shows, re-theme the background, or capture fresh app screens. Trigger on direct and indirect phrasing: "change the store screenshots", "regenerate the App Store images", "frame my screenshots", "update the screenshot captions", "new store screenshots", "capture app screenshots". Deterministic framing (sharp + text-to-svg); never hand-edit the framed PNGs or fabricate app UI (Apple Guideline 2.3.3).
---

# Store screenshots (Kiroku)

The single front door for App Store + Google Play screenshots. One workflow runs
all four stages for both platforms, wired to share one manifest so they can never
silently drift:

**seed → capture (iOS + Android) → ingest → frame → upload**

- **Manifest (single source of truth):** [`scripts/store-screenshots.config.mjs`](../../../scripts/store-screenshots.config.mjs)
  — the shot list (each `{snapshot, raw, caption}`), locales, the `captureLocales`
  map, the `platforms` map (capture dirs + framed sizes per platform), and the
  visual theme.
- **CI workflow:** [`screenshots.yml`](../../../.github/workflows/screenshots.yml)
  (manual dispatch). Internals + local fallback:
  [`contributingGuides/SCREENSHOTS.md`](../../../contributingGuides/SCREENSHOTS.md).
- **Scripts:** [`ingest-store-screenshots.mjs`](../../../scripts/ingest-store-screenshots.mjs)
  (`npm run ingest-screenshots`) and [`frame-app-store-screenshots.mjs`](../../../scripts/frame-app-store-screenshots.mjs)
  (`npm run frame-screenshots`) — both take `--platform ios|android` (default `ios`).

## The one hard rule (Apple Guideline 2.3.3)

Screenshots must depict the SHIPPED app. This pipeline only adds marketing chrome
(background + caption) around your genuine captures. Never fabricate or
AI-generate the app UI inside a screenshot — a reviewer comparing them to the
build will reject mismatches. Only the background/caption layer is synthesized.

## One button (the normal path)

```bash
gh workflow run screenshots.yml \
  -f device_subset=all \   # all | phone-only | ipad-only (iOS matrix)
  -f upload=none \         # none = artifacts only | draft = write store listing | submit = also submit iOS for review
  -f seed=true             # seed a current-month demo session first (best-effort)
gh run watch
```

What it does, per platform (iOS job + Android job):

1. **Seed** — runs kiroku-cli `seedDemoSession` so the demo account has a
   current-month session (the Day Overview shot taps a calendar `DayMarking`
   cell). Best-effort + idempotent; if the seed secrets aren't configured it's a
   non-blocking skip — fall back to seeding manually (sign in to the demo account,
   log one session this month).
2. **Capture** — fastlane `snapshot` (iOS) / `screengrab` (Android).
3. **Ingest + frame** — runs the scripts below; the framed images are the
   workflow artifact (`ios-framed-screenshots-*` / `android-framed-screenshots-*`).
4. **Upload** (when `upload != none`) — `deliver` to the editable App Store
   version and `supply` to the Play listing. `submit` additionally submits the iOS
   version for review (`automatic_release:false`, so it stays Pending Developer
   Release). The `asc` skill remains the deliberate submit path.

To **change captions / theme only** (no app-UI change), skip the workflow: download
a prior run's raw artifact (or reuse local captures) and run ingest+frame locally.

## Local iteration (no CI)

```bash
# iOS
npm run ingest-screenshots -- --from <unzipped-artifact-dir>   # → raw/ios/<locale>/
npm run frame-screenshots                                      # → framed/ios/<locale>/<device>/
# Android
npm run ingest-screenshots -- --platform android --from <dir>  # → raw/android/<locale>/
npm run frame-screenshots -- --platform android                # → framed/android/<locale>/phone/
```

Add `--check` for a dry run; scope with `--locale cs` (and `--device 6.9` on
frame). Ingest renames `01_Home.png → 01-home.png`, remaps `cs-CZ → cs`, reads the
iOS `iPhone 17 Pro Max` master / Android `images/` dir, and skips captures with no
manifest entry (e.g. `05_Settings`). Each framed image is verified to be exactly
the configured pixel size before writing.

## Making changes

- **Captions / shot order / which screens shown:** edit the `shots` array in the
  config. English is authoritative; run the `translate` skill for non-English
  captions rather than hand-writing them. Keep Kiroku's harm-reduction framing —
  never celebrate drinking _volume_.
- **Background / fonts / sizing / corner radius:** edit `theme` in the config.
- **Locales:** edit `locales` + add the matching `captureLocales` entry.
- **Output sizes:** edit `platforms.<p>.devices` (iOS must stay exact App Store
  dimensions; Android must stay ≤ 2:1 aspect or Google Play rejects it).
- **Which screens get captured:** edit the UI tests
  (`ios/KirokuUITests/ScreenshotTests.swift` + `android/app/src/androidTest/.../ScreenshotTest.kt`)
  and the `snapshot` fields together, then re-capture. The set is currently 6:
  Home, LiveSession, DayOverview, Statistics, AlcoholFree (Badges), Profile;
  `05_Settings` is captured but intentionally unmapped.
