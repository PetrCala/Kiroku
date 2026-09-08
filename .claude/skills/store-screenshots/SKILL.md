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

### 0. Prerequisite: shape the demo account first

Capture logs into the `APPLE_DEMO_*` account, and the Day Overview shot taps the
first calendar day the app reports a recorded session on (the
`calendar-day-<date>-has-sessions` identifier), preferring the dates given in the
`demo_session_dates` workflow input. **Before capturing, sign in to the demo
account and log at least one drinking session in the current calendar month**,
and pass its date: with no session anywhere in the month the shot lands on an
empty day, which is not publishable.

That is only the mechanical minimum. The demo account's data becomes the App
Store listing, so it also has to pass an editorial bar: it must look like someone
**moderating**. The binding contract, with target numbers, is the "Demo-account
data contract" comment block at the top of the `shots` section in
[`scripts/store-screenshots.config.mjs`](../../../scripts/store-screenshots.config.mjs).
Read it before dispatching a run, and re-read it if you are tempted to reuse an
old capture.

`kiroku-cli seedDemoSession` (kiroku-cli repo) applies that contract to the demo
account's current month and prints the dates it wrote, which are what
`demo_session_dates` wants. Run `--dry-run` first; it replaces the month rather
than topping it up. Do not reach for `seedTestSessions`: it flags 12% of
sessions as blackouts and itemises double-digit drink counts.

Note the count is prorated by how far into the month you are. Capturing in the
first week of a month yields a calendar with only two or three marked days,
which is honest but a sparse hero shot; mid-month or later fills the grid.

Two hard stops, both learned from the 2026-07 Guideline 1.4 rejection:

- **Never publish a shot showing the word "sober" next to a person.** The friend
  row now reads as elapsed time since a logged session ("3h" / "last session").
  A capture showing "1h sober" came from a build predating that fix.
- **Never publish red or black calendar tiles, or a session itemising
  double-digit drink counts.** Red means >10 units in a day; black is the
  self-reported blackout flag. Both read as celebrating volume (Guideline 1.4.3)
  on an app already flagged under 1.4.

### 1. Capture (slow, uses CI minutes — only when the app UI changed)

```bash
# One dispatch per language: `snapshot` relaunches the app between languages,
# which reliably crashes the runner, so `all` is not a real capture.
# Run them SEQUENTIALLY. Both sign into the same demo account and step 02 opens
# a live session on it, so overlapping runs put an "In session" banner on each
# other's Home shot and resume each other's sessions.
gh workflow run screenshots.yml -f device_subset=phone-only -f language_subset=en-only \
  -f demo_session_dates=<oldest-first ISO dates> -f capture_watch=true
gh run watch                                           # let it FINISH first
gh workflow run screenshots.yml -f device_subset=phone-only -f language_subset=cs-only \
  -f demo_session_dates=<same dates> -f capture_watch=false
gh run watch                                           # wait for the run
gh run download <run-id> -D /tmp/shots                 # ios-screenshots-<sha>
gh run download <run-id> -D /tmp/watch                 # watch-screenshot-<sha>
```

The watch job (`capture_watch`, on by default) is its own ~60-minute runner and
produces one English capture that ingest fans out to every locale, so run it on
one dispatch only. Budget 2-3 hours per dispatch, and note artifacts expire:
re-check `gh api repos/{owner}/{repo}/actions/runs/<id>/artifacts` before
planning to reuse an old run.

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

### 3. Frame: render the store-sized images and stage the upload folders

```bash
npm run frame-screenshots -- --check     # confirm raw inputs are present
npm run frame-screenshots -- --stage     # framed/<locale>/<device>/ + upload/<locale>/
```

Scope while iterating with `--locale cs` / `--device 6.9` (`--device` takes an id
or a whole kind, e.g. `watch`, and errors out when it matches neither). Each
output is verified to be exactly the required pixel size before it's written.

`--stage` writes `fastlane/store-screenshots/upload/<locale>/`, one FLAT folder
per locale holding only the sizes marked `upload: true` in the config, renumbered
so filename order is store order. It refuses to run under a `--device` scope,
because it rewrites the whole folder.

### 4. Upload to App Store Connect

`scripts/asc.mjs shots` uploads one locale from one FLAT folder of PNGs, in
filename order, and picks each ASC slot from the image's own pixel size. Point it
at the staged folder, one locale per run:

```bash
node scripts/asc.mjs shots --app-id <id> --dir fastlane/store-screenshots/upload/en-US --locale en-US --replace          # dry run
node scripts/asc.mjs shots --app-id <id> --dir fastlane/store-screenshots/upload/en-US --locale en-US --replace --yes    # write
```

**Never point it at `framed/**`.\*\* The staged folder is 6.9 plus one watch size
because the other three rendered sizes collide, and both collisions surface hours
later rather than as an error:

- **6.7 is skipped.** Both 1320x2868 and 1290x2796 map to `APP_IPHONE_67`, so
  feeding both puts 12 images in a 6-image slot. Upload the 6.9 set and let
  Apple scale.
- **Exactly one watch size ships, the 368x448 `APP_WATCH_SERIES_4`.** A version
  may carry only one Apple Watch display type; a second set fails with HTTP 409
  `MULTIPLE_APPLE_WATCH_SCREENSHOT_TYPES_NOT_ALLOWED_IN_VERSION`. SERIES_4 is
  also the slot ASC demands before it accepts a submission whose build embeds
  the watch app.

`--replace` deletes what is in each touched set first; without it the upload
appends to the existing screenshots. Apple processes assets asynchronously, so
confirm every screenshot reports `assetDeliveryState` `COMPLETE` before
submitting.

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
