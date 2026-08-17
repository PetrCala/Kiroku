# Store screenshots

Fastlane `snapshot` (iOS) + `screengrab` (Android) capture App Store / Play
Store screenshots across the device + locale matrix declared in
[`fastlane/Snapfile`](../fastlane/Snapfile) and
[`fastlane/Screengrabfile`](../fastlane/Screengrabfile).

The supported way to capture screenshots is the
[`screenshots.yml`](../.github/workflows/screenshots.yml) GitHub Actions
workflow. Running locally still works (see [Local fallback](#local-fallback)
below) but requires hand-editing the Xcode project, which must NEVER be
committed.

---

## Prerequisite: the demo account's data IS the marketing copy

Both the CI and local flows log into a real Kiroku account using the
`APPLE_DEMO_EMAIL` / `APPLE_DEMO_PASSWORD` credentials (the same demo account
Apple uses for App Store Review). The Day Overview screenshot opens a calendar
day cell (`calendar-day-<YYYY-MM-DD>`), so **before triggering a capture,
confirm the demo account has at least one logged session in the current
calendar month** and pass those dates in the `demo_session_dates` workflow
input. Without them the test falls back to the newest day the calendar reports
sessions on, which is not necessarily the day the shot should show.

The grid renders a cell for every day of the month, so a cell existing proves
nothing about that day's data. Days that hold sessions carry a second
identifier, `calendar-day-<YYYY-MM-DD>-has-sessions` (see `DayComponent`), and
the test checks that before tapping. Every date it skips is logged as a
`[capture-note]`, so a stale `demo_session_dates` shows up in the run log
instead of quietly producing a Day Overview centred on some other day.

That is the mechanical minimum. The editorial requirement is stricter, and the
full contract (with target numbers) lives next to the shot list in
[`scripts/store-screenshots.config.mjs`](../scripts/store-screenshots.config.mjs).
Read it before dispatching a run. In short: the account must look like someone
**moderating**, because whatever it contains ends up on the App Store.

The 2026-07 set is the cautionary tale. It was captured from an account showing
a friend list of seven people each labelled "1h sober" / "2Y sober", a month
totalling 84.5 units with single days of 33.2 and 23.5, and a session summary
itemising 33 drinks. App Review rejected that version under Guideline 1.4
(Physical Harm) for being "marketed as a blood alcohol content calculator", and
a published screenshot of per-person sobriety timers is the most plausible thing
a reviewer read that way. Screenshots are not decoration here; they are the
evidence a reviewer judges the app on.

---

## CI flow (recommended)

1. Go to **Actions → "Capture App Store / Play Store screenshots" → Run
   workflow**.
2. Pick a branch (usually `master`) and the inputs:
   - `device_subset`: `all`, `phone-only`, or `ipad-only`. The framing
     pipeline derives every output size from the 6.9" iPhone master, and the
     live App Store listing has no iPad set, so `phone-only` is normally the
     right answer.
   - `demo_session_dates`: comma-separated ISO dates the demo account has
     sessions on, newest first (for example
     `2026-08-14,2026-08-09,2026-08-05`). The Day Overview shot opens the
     first one the calendar confirms has sessions; dates with no data are
     skipped, and if none of them have any, the newest day that does is used.
   - `dump_a11y`: log the full accessibility tree for every screen. Turn this
     on whenever a selector broke.
   - `fail_slow`: keep going after a build or launch error.
3. Budget about an hour. Roughly 12 minutes of setup, ~45 minutes to build the
   scheme (the app, every pod, and the embedded watch target) before a single
   screenshot is taken, then a few minutes per device/language pair.
4. When the run finishes, download the `ios-screenshots-<sha>` artifact from
   the workflow summary page. PNGs are organized as
   `ios/<locale>/<device>/*.png`.
5. `ios-fastlane-logs-<sha>` is uploaded on every run, pass or fail, because
   the accessibility dump and the `[capture-miss]` lines live in the snapshot
   log and that is exactly when you want them.

### Why a green UI test is not the signal

The UI test never asserts. A step that cannot reach its screen records a
`[capture-miss]` line and moves on, for two reasons:

- A missed step must never publish the WRONG screen. The 2026-07 set shipped
  three shots that were really Statistics screens under other filenames,
  because the helpers tapped optimistically and `snapshot()` captured whatever
  was still on screen. Now a step that cannot reach its screen takes no
  screenshot at all.
- One broken selector must not hide the other five, given the round trip.

`scripts/verify-captured-screenshots.mjs` is the gate instead. It runs as a
workflow step, compares the PNGs on disk against the shot manifest in
`scripts/store-screenshots.config.mjs`, and fails the job on anything missing
or suspiciously small. Run it yourself with `npm run verify-screenshots`.

When it fails, grep the fastlane log artifact for `[capture-miss]`.

### Required GitHub secrets

| Secret                | Used for                                          |
| --------------------- | ------------------------------------------------- |
| `APPLE_DEMO_EMAIL`    | Demo account login (App Store Review credentials) |
| `APPLE_DEMO_PASSWORD` | Demo account password                             |
| `PROD_ENV_FILE`       | Contents of `.env.production`                     |

`KIROKU_DEMO_EMAIL` / `KIROKU_DEMO_PASSWORD` (used inside the UI test) are
aliased from `APPLE_DEMO_*` in the workflow, so you only need one set.

### How it works

The CI workflow:

1. Checks out the branch, sets up Node + Ruby + CocoaPods.
2. Runs [`scripts/setup-screenshots-test-target.rb`](../scripts/setup-screenshots-test-target.rb)
   inside the `ios :screenshots` lane. The script:
   - Generates a `KirokuUITests` UI Testing Bundle target in
     `ios/kiroku.xcodeproj` programmatically via the `xcodeproj` Ruby gem.
   - Copies `SnapshotHelper.swift` from the bundled fastlane gem into
     `ios/KirokuUITests/`.
   - Adds the target to the `Kiroku (production)` shared scheme's
     `TestAction`.
3. Runs `fastlane ios screenshots` → `capture_ios_screenshots` → boots
   simulators and runs `ScreenshotTests`.
4. Uploads the resulting PNGs as an artifact.

The pbxproj/scheme/`SnapshotHelper.swift` diff produced by the setup script
is **intentionally throwaway**: the workflow runs on a fresh checkout each
time, so nothing leaks back into the repo.

### Why we generate the target instead of committing it

Adding a UI Testing Bundle target via Xcode's UI in Xcode 26:

- Bumps `ios/kiroku.xcodeproj/project.pbxproj` to `objectVersion = 70`.
- Restructures the file using `PBXFileSystemSynchronizedRootGroup` (Xcode
  26's new format).

The `xcodeproj` Ruby gem 1.27.0 (latest released) cannot parse
`objectVersion = 70` and crashes with
`ArgumentError - Unable to find compatibility version string for object
version 70`. CocoaPods uses the `xcodeproj` gem internally, so committing
the Xcode-generated pbxproj would break `bundle exec pod install` for every
developer.

The generation script preserves `objectVersion = 54` and uses the older
PBXGroup-style layout, sidestepping the issue. See the script header for the
full rationale.

---

## From captures to framed store images

Capturing produces raw PNGs; the store needs them **framed** (a branded
background with a caption, at exact App Store Connect pixel sizes). Two
deterministic Node steps bridge the gap, both driven by the shared manifest
[`scripts/store-screenshots.config.mjs`](../scripts/store-screenshots.config.mjs)
so capture and framing can't drift:

1. **Ingest** maps the capture output into the framing inputs:

   ```bash
   # from a downloaded CI artifact:
   npm run ingest-screenshots -- --from <unzipped-artifact-dir>
   # or from a local fastlane/screenshots/ios capture:
   npm run ingest-screenshots
   ```

   It copies + renames each capture into
   `fastlane/store-screenshots/raw/<locale>/` (`01_Home.png` → `01-home.png`),
   remaps `cs-CZ` → `cs`, reads the `iPhone 17 Pro Max` master, and skips captures
   with no manifest entry. Add `--check` for a dry run.

2. **Frame** renders the store-sized marketing images:

   ```bash
   npm run frame-screenshots   # → fastlane/store-screenshots/framed/<locale>/<device>/
   ```

Then upload `framed/**` to App Store Connect. The full runbook (the
in-month-session prerequisite, the `gh` capture-dispatch commands, and how to make
changes) lives in the `store-screenshots` skill.

> **Current screen set (6):** Home, LiveSession, DayOverview, Statistics,
> AlcoholFree (the Statistics "Trends" tab), and Friends. `07_Settings` is
> captured but intentionally left unmapped: it sells nothing.

### Apple Watch screenshot (CI job, manual fallback)

The App Store build embeds the watchOS companion, so App Store Connect requires
an Apple Watch screenshot (`APP_WATCH_SERIES_4`) before the iOS version can be
submitted for review. The watch shot is **not** part of the fastlane `snapshot`
matrix: the companion is a phone-tethered remote, so a watchOS UI test on an
unpaired simulator only shows the "Open Kiroku on your phone" reconnect screen.

The `watch` job of `screenshots.yml` (on by default; `capture_watch` input)
captures it in CI: it builds the production scheme for testing, installs the
phone and watch apps on a freshly paired simulator pair, signs the phone in via
`ios/KirokuUITests/WatchCaptureSignInTests.swift` (which also best-effort opens
a live session so the watch shows the unit counter), relaunches the phone app so
`WatchBridge` pushes the credential over WatchConnectivity, launches the watch
app, and screenshots it with `simctl io`. The capture lands at
`fastlane/screenshots/ios/watch/watch.png` (the `watch-screenshot-<sha>`
artifact), `npm run ingest-screenshots` fans it out to every locale's `raw/`
folder (the watch UI follows the watch simulator's system locale, so one
English capture serves all locales; only the framed caption is localized), and
`npm run verify-screenshots -- --require watch` is the job's gate. Two gotchas
the job handles, for anyone touching it:

- On iphonesimulator the app id resolves to `org.reactjs.native.example.kiroku`
  while the watch app's `WKCompanionAppBundleIdentifier` expects
  `...alcohol-tracker`, so the watch app refuses to install;
  `scripts/set-simulator-bundle-id.rb` scopes the fix to the `kiroku` target
  (a command-line override would poison the UI-test runner's id, and
  `-sdk iphonesimulator` breaks the watch asset catalog build).
- The phone only pushes the credential when WCSession reports the watch app
  installed, so the install happens before the sign-in test runs.

Manual fallback (e.g. to reshoot a specific watch state):

1. In Xcode, run the **`Kiroku Watch App`** target on a watch simulator paired
   with a booted iPhone that is signed in to the demo account (so a credential
   reaches the watch and it shows a live session, not the reconnect screen).
2. Start a session and log a couple of units so the screen has real content.
3. Screenshot the watch simulator (`Cmd-S` in the Simulator, or
   `xcrun simctl io booted screenshot watch.png`).
4. Drop the PNG at `fastlane/store-screenshots/raw/<locale>/watch.png` for each
   locale in the manifest (capture per locale, or reuse the same shot).
5. Run `npm run frame-screenshots -- --device watch` to render the framed
   watch outputs at `framed/<locale>/watch/`.

The framing pipeline scales any watch capture to fit the exact ASC watch slots
on the brand background with a caption; the sizes, caption, and per-device
scoping (`kind: 'watch'`) live in the manifest. Guideline 2.3.3 still applies:
the capture must be the real shipped watch UI.

---

## Local fallback

Use this if you want to iterate on `ScreenshotTests.swift` against your own
simulators without waiting for CI cycles.

### Prerequisites

```bash
export APPLE_DEMO_EMAIL="..."
export APPLE_DEMO_PASSWORD="..."
export KIROKU_DEMO_EMAIL="$APPLE_DEMO_EMAIL"
export KIROKU_DEMO_PASSWORD="$APPLE_DEMO_PASSWORD"
```

### iOS

```bash
bundle install                              # one-time
bundle exec fastlane ios screenshots
```

The `ios :screenshots` lane invokes `scripts/setup-screenshots-test-target.rb`
automatically, so you do not need to run it by hand. After capture, these files
will be modified:

- `ios/kiroku.xcodeproj/project.pbxproj`
- `ios/kiroku.xcodeproj/xcshareddata/xcschemes/Kiroku (production).xcscheme`
- `ios/KirokuUITests/SnapshotHelper.swift` (created)

> **Do NOT commit those changes.** Revert them when you're done:
>
> ```bash
> git checkout -- \
>   "ios/kiroku.xcodeproj/project.pbxproj" \
>   "ios/kiroku.xcodeproj/xcshareddata/xcschemes/Kiroku (production).xcscheme"
> rm -f ios/KirokuUITests/SnapshotHelper.swift
> ```

Output PNGs land in `fastlane/screenshots/ios/<locale>/<device>/*.png`.

If you want to add the target manually in Xcode anyway (e.g. to debug the
test in the Xcode UI), be aware that **Xcode 26 will rewrite the pbxproj** in
a way that breaks `pod install` for everyone. Do this only on a throwaway
branch and never push the result.

### Android

The `android :screenshots` lane still needs a few one-time setup steps that
are documented but not yet wired into CI:

1. **Add screengrab dependencies** to `android/app/build.gradle`:

   ```groovy
   android {
       defaultConfig {
           testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
       }
   }
   dependencies {
       androidTestImplementation 'tools.fastlane:screengrab:2.1.1'
       androidTestImplementation 'androidx.test:runner:1.5.2'
       androidTestImplementation 'androidx.test:rules:1.5.0'
       androidTestImplementation 'androidx.test.uiautomator:uiautomator:2.2.0'
       androidTestImplementation 'androidx.test.ext:junit:1.1.5'
   }
   ```

2. **Add the CHANGE_CONFIGURATION permission** to
   `android/app/src/debug/AndroidManifest.xml` (screengrab needs it to switch
   locales at runtime). Create the file if it doesn't exist:

   ```xml
   <manifest xmlns:android="http://schemas.android.com/apk/res/android">
       <uses-permission android:name="android.permission.CHANGE_CONFIGURATION"/>
   </manifest>
   ```

3. **Boot the AVD you want to capture against** (Pixel 7 emulator is a good
   default for the phone bucket):

   ```bash
   emulator -avd Pixel_7_API_34
   ```

4. **Run:**

   ```bash
   bundle exec fastlane android screenshots
   ```

An Android CI job (using `reactivecircus/android-emulator-runner`) is a
planned follow-up; see the TODO at the bottom of `screenshots.yml`.

---

## Known gaps the first run will surface

The UI test code in
[`ios/KirokuUITests/ScreenshotTests.swift`](../ios/KirokuUITests/ScreenshotTests.swift)
and
[`android/app/src/androidTest/.../ScreenshotTest.kt`](../android/app/src/androidTest/java/com/alcohol_tracker/screenshots/ScreenshotTest.kt)
makes a few assumptions that may need adjustment after the first run:

- **Inputs lack `testID`s.** The login fields are matched by `firstMatch` on
  text/secure text fields. If a future screen change reorders them, login
  breaks. Long-term fix: add `testID="loginEmail"` / `testID="loginPassword"`
  on the inputs in `src/screens/SignUp/AuthScreen.tsx`.

- **Bottom tab bar buttons lack `testID`s.** Matched by their localized
  labels (`"Start"`, `"Settings"`, `"Nastavení"`…). If translations change
  in [`src/languages/en.ts`](../src/languages/en.ts) or
  [`src/languages/cs_cz.ts`](../src/languages/cs_cz.ts), update the matcher
  arrays in the test files to match.

- **Submit button labels.** Same story, matched on `"Log In"` /
  `"Přihlásit se"`. Update if the strings change.

- **Calendar day cells.** The test taps the first element with the
  accessibility identifier `DayMarking`. If your demo account has no recorded
  sessions in the current month, this selector will fail; see the
  prerequisite at the top of this doc.

- **In-app locale switch flow.** The test navigates
  Settings → Preferences → Language → (Czech/English). If the menu structure
  changes, update `switchLocaleIfNeeded()` in both test files.

---

## What this doesn't include (yet)

- **Android CI job**: the `android :screenshots` lane works locally but
  needs the Gradle setup + AVD wiring + manifest permission landed on master
  before it can be lifted into CI. Follow-up.
- **`frameit` device bezels**: uncomment the line in the iOS lane once
  you've installed it (`bundle exec fastlane frameit setup`).
- **Auto-upload to App Store Connect / Play Console**: both lanes currently
  stop after capturing PNGs. Wiring them into the existing `production`
  lanes via `deliver` / `supply` with `skip_screenshots: false` is the
  natural next step once you trust the output.
- **Underlying `kirokuTests` `SWIFT_VERSION` fix**: the workaround lives in
  `fastlane/Snapfile` (`xcargs("SWIFT_VERSION=5.0")`). The root-cause fix
  belongs in a separate PR that edits the `kirokuTests` target in
  `ios/kiroku.xcodeproj`.
