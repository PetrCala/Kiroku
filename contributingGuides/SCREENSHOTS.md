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

## Prerequisite: demo account must have a session this month

Both flows log into a real Kiroku account using the `APPLE_DEMO_EMAIL` /
`APPLE_DEMO_PASSWORD` credentials (the same demo account Apple uses for App Store
Review). The Day Overview screenshot taps the first calendar day with a recorded
session, so the demo account needs **at least one drinking session in the current
calendar month** — otherwise the test fails on a missing `DayMarking`.

The CI workflow **auto-seeds** this: a "Seed demo session" step runs the
kiroku-cli `seedDemoSession` command (idempotent) before capture, gated by the
`seed` input (default on) and best-effort (`continue-on-error`). It needs the
`KIROKU_ADMIN_TOKEN` and `KIROKU_ADMIN_SDK_PROD` secrets; until those are configured
(and for local runs), seed manually: sign in to the demo account and log one
session this month.

---

## CI flow (recommended)

1. Go to **Actions → "Capture App Store / Play Store screenshots" → Run
   workflow**.
2. Pick a branch (usually `master`) and the inputs:
   - `device_subset` — `all` / `phone-only` / `ipad-only` (trims the iOS matrix).
   - `upload` — `none` (artifacts only), `draft` (write the framed images to the
     editable App Store + Play listings), or `submit` (also submit the iOS
     version for review; `automatic_release:false`, so it stays Pending Developer
     Release).
   - `seed` — auto-seed a current-month demo session first (default on).
3. Two jobs run: **iOS** (App Store) and **Android** (Play, on an emulator). Each
   captures, then ingests + frames in-CI. When the run finishes, download the
   `ios-framed-screenshots-<sha>` / `android-framed-screenshots-<sha>` artifacts
   (the marketing-ready images); the raw captures ship as
   `*-raw-screenshots-<sha>` for triage.
4. If the run failed, the `ios-fastlane-logs-<sha>` artifact contains
   `gym`/`snapshot` logs for triage.

### Required GitHub secrets

| Secret                    | Used for                                                      |
| ------------------------- | ------------------------------------------------------------- |
| `APPLE_DEMO_EMAIL`        | Demo account login (App Store Review credentials)             |
| `APPLE_DEMO_PASSWORD`     | Demo account password                                         |
| `PRODUCTION_ENV_FILE`     | Contents of `.env.production`                                 |
| `LARGE_SECRET_PASSPHRASE` | Decrypts the ASC / Play API keys (only when `upload != none`) |
| `KIROKU_ADMIN_TOKEN`      | Read access to the private kiroku-cli repo (seed step)        |
| `KIROKU_ADMIN_SDK_PROD`   | Prod Firebase admin SDK JSON (seed step)                      |

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
is **intentionally throwaway** — the workflow runs on a fresh checkout each
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
background with a caption, at exact store pixel sizes). Two deterministic Node
steps bridge the gap — both driven by the shared manifest
[`scripts/store-screenshots.config.mjs`](../scripts/store-screenshots.config.mjs)
so capture and framing can't drift, and both take `--platform ios|android`
(default `ios`):

1. **Ingest** maps the capture output into the framing inputs:

   ```bash
   npm run ingest-screenshots -- --from <unzipped-artifact-dir>      # iOS, from a CI artifact
   npm run ingest-screenshots                                        # iOS, from local fastlane/screenshots/ios
   npm run ingest-screenshots -- --platform android --from <dir>     # Android
   ```

   It copies + renames each capture into
   `fastlane/store-screenshots/raw/<platform>/<locale>/` (`01_Home.png` →
   `01-home.png`), remaps `cs-CZ` → `cs`, reads the iOS `iPhone 17 Pro Max` master
   / Android `images/` dir, and skips captures with no manifest entry. Add
   `--check` for a dry run.

2. **Frame** renders the store-sized marketing images:

   ```bash
   npm run frame-screenshots                       # → framed/ios/<locale>/<device>/
   npm run frame-screenshots -- --platform android # → framed/android/<locale>/phone/
   ```

In CI these two steps run automatically after capture, and (when the `upload`
input is set) the framed images are pushed to App Store Connect / Play via the
`:upload_screenshots` / `:upload_play_store_screenshots` fastlane lanes. The full
runbook lives in the `store-screenshots` skill.

> **Current screen set (6):** Home, LiveSession, DayOverview, Statistics,
> AlcoholFree (Badges), Profile. The UI tests also capture `05_Settings`, which is
> intentionally not a marketing shot and is left unmapped.

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
automatically — you don't need to run it by hand. After capture, these files
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
planned follow-up — see the TODO at the bottom of `screenshots.yml`.

---

## Known gaps the first run will surface

The UI test code in
[`ios/KirokuUITests/ScreenshotTests.swift`](../ios/KirokuUITests/ScreenshotTests.swift)
and
[`android/app/src/androidTest/.../ScreenshotTest.kt`](../android/app/src/androidTest/java/com/alcohol_tracker/screenshots/ScreenshotTest.kt)
makes a few assumptions that may need adjustment after the first run:

- **Login inputs** now carry `testID="loginEmail"` / `testID="loginPassword"`
  (in `src/screens/SignUp/AuthScreen.tsx`); both `logIn()` helpers prefer those
  ids and wait for the fields to mount, falling back to the old positional
  match (iOS `firstMatch`, Android EditText-by-index) for older builds.

- **Bottom tab bar buttons lack `testID`s.** Matched by their localized
  labels (`"Start"`, `"Settings"`, `"Nastavení"`…). If translations change
  in [`src/languages/en.ts`](../src/languages/en.ts) or
  [`src/languages/cs_cz.ts`](../src/languages/cs_cz.ts), update the matcher
  arrays in the test files to match.

- **Submit button labels.** Same story — matched on `"Log In"` /
  `"Přihlásit se"`. Update if the strings change.

- **Calendar day cells.** The test taps the first element with the
  accessibility identifier `DayMarking`. If your demo account has no recorded
  sessions in the current month, this selector will fail — see the
  prerequisite at the top of this doc.

- **In-app locale switch flow.** The test navigates
  Settings → Preferences → Language → (Czech/English). If the menu structure
  changes, update `switchLocaleIfNeeded()` in both test files.

---

## Known follow-ups

- **First-dispatch validation** — the Android emulator job, screengrab's exact
  output naming, and the `deliver` / `supply` screenshot layouts are wired but
  only proven by a real iOS + Android dispatch; expect to iterate on the first
  run. The `deliver` `screenshots_path` points at the nested `framed/ios/<locale>/<device>/`
  tree (device inferred by dimensions) — if a run rejects it, flatten per locale.
- **Seed secrets** — the auto-seed step needs `KIROKU_ADMIN_TOKEN` +
  `KIROKU_ADMIN_SDK_PROD`; until set it's a non-blocking skip (seed manually).
- **`frameit` device bezels** — uncomment the line in the iOS lane once
  you've installed it (`bundle exec fastlane frameit setup`).
- **Underlying `kirokuTests` `SWIFT_VERSION` fix** — the workaround lives in
  `fastlane/Snapfile` (`xcargs("SWIFT_VERSION=5.0")`). The root-cause fix
  belongs in a separate PR that edits the `kirokuTests` target in
  `ios/kiroku.xcodeproj`.
