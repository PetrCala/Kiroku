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

Both the CI and local flows log into a real Kiroku account using the
`APPLE_DEMO_EMAIL` / `APPLE_DEMO_PASSWORD` credentials (the same demo account
Apple uses for App Store Review). The Day Overview screenshot taps the first
day cell with a recorded session — so **before triggering a capture, log in to
the demo account and record at least one drinking session in the current
calendar month**. Without an in-month session, the test fails with a missing
`DayMarking` accessibility identifier.

---

## CI flow (recommended)

1. Go to **Actions → "Capture App Store / Play Store screenshots" → Run
   workflow**.
2. Pick a branch (usually `master`) and fill the inputs:
   - **`platform`** — `both` (default), `ios-only`, or `android-only`. Each
     platform is an independent job that runs in parallel when both are
     selected. Pick a single platform when iterating on the test code for
     that platform.
   - **`device_subset`** (iOS only) — `all` (iPhone 17 Pro Max + iPad Pro
     13" M5, ~30-40 min), `phone-only` (~20 min), `ipad-only` (~15 min).
     Ignored for Android.
   - **`android_locales_subset`** — `all` (en-US + cs-CZ, ~30 min),
     `en-US`, or `cs-CZ`. A single locale halves the Android test phase.
3. When the run finishes, download the artifacts from the workflow summary:
   - `ios-screenshots-<sha>` — PNGs organized as `ios/<locale>/<device>/*.png`
   - `android-screenshots-<sha>` — PNGs organized as
     `android/<locale>/phone/*.png`
4. If a job failed, its log artifact (`ios-fastlane-logs-<sha>` /
   `android-screengrab-logs-<sha>`) contains build + test traces for triage.

### Required GitHub secrets

| Secret                       | Used for                                            |
| ---------------------------- | --------------------------------------------------- |
| `APPLE_DEMO_EMAIL`           | Demo account login (App Store Review credentials)   |
| `APPLE_DEMO_PASSWORD`        | Demo account password                               |
| `PRODUCTION_ENV_FILE`        | Contents of `.env.production`                       |
| `LARGE_SECRET_PASSPHRASE`    | Android: decrypts the upload keystore               |
| `MYAPP_UPLOAD_STORE_PASSWORD`| Android: unlocks the keystore at signing time       |
| `MYAPP_UPLOAD_KEY_PASSWORD`  | Android: unlocks the upload key at signing time     |

`KIROKU_DEMO_EMAIL` / `KIROKU_DEMO_PASSWORD` (used inside the UI tests) are
aliased from `APPLE_DEMO_*` in the workflow, so you only need one set of
demo creds.

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

The Gradle config (`testInstrumentationRunner` + `androidTestImplementation`
deps) and the `CHANGE_CONFIGURATION` permission in
`android/app/src/debug/AndroidManifest.xml` are already committed, so the
lane just works:

```bash
emulator -avd Pixel_6_API_34   # or any phone AVD you've created locally
bundle exec fastlane android screenshots
```

Output PNGs land in `fastlane/screenshots/android/<locale>/phone/*.png`.

Notes when running locally:

- The lane builds the Production Release APK, which requires the upload
  keystore (`android/app/kiroku-play-key.keystore`) to be present and
  unlockable. Set `MYAPP_UPLOAD_STORE_PASSWORD` / `MYAPP_UPLOAD_KEY_PASSWORD`
  in your shell to match the keystore (the same values the CI workflow uses).
- The first emulator boot is ~5-10 min; subsequent runs against the same
  AVD reuse its snapshot and are much faster.
- If you only want to iterate against a single locale, edit
  [`fastlane/Screengrabfile`](../fastlane/Screengrabfile) and reduce the
  `locales([...])` list. Don't commit the change.

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

- **Submit button labels.** Same story — matched on `"Log In"` /
  `"Přihlásit se"`. Update if the strings change.

- **Calendar day cells.** The test taps the first element with the
  accessibility identifier `DayMarking`. If your demo account has no recorded
  sessions in the current month, this selector will fail — see the
  prerequisite at the top of this doc.

- **In-app locale switch flow.** The test navigates
  Settings → Preferences → Language → (Czech/English). If the menu structure
  changes, update `switchLocaleIfNeeded()` in both test files.

- **Android `EditText` matching by index.** The Kotlin test uses
  `By.clazz("android.widget.EditText")` and assumes email is index 0 +
  password is index 1. If RN ever renders additional inputs on `AuthScreen`
  this breaks silently — adding `testID`s (which translate to
  `android:contentDescription` on RN Android) is the same long-term fix as
  iOS.

- **Android emulator boot flakiness.** `reactivecircus/android-emulator-runner`
  occasionally fails to bring the AVD up within the 10-minute boot timeout
  (~10-15% of cold runs). Re-trigger the workflow if the
  `Run Fastlane - Capture Android screenshots` step fails before the test
  phase even starts. If this happens often, the next optimization is the
  2-step AVD cache pattern from the action's README.

---

## What this doesn't include (yet)

- **Android AVD caching.** The 2-step `reactivecircus/android-emulator-runner`
  pattern (pre-warm + cache `~/.android/avd/*`, restore on subsequent runs)
  shaves ~6-8 min off each Android run. Skipped for v1 — add once the
  workflow is reliable.
- **Android tablet capture.** The `Screengrabfile` is `device_type("phone")`
  only. Play Store accepts phone-only submissions and auto-derives smaller
  tiers from the largest, but adding a `Pixel_Tablet_API_34` emulator
  variant covers the 10" tablet tier explicitly.
- **`frameit` device bezels** — uncomment the line in the iOS lane once
  you've installed it (`bundle exec fastlane frameit setup`).
- **Auto-upload to App Store Connect / Play Console** — both lanes currently
  stop after capturing PNGs. Wiring them into the existing `production`
  lanes via `deliver` / `supply` with `skip_screenshots: false` is the
  natural next step once you trust the output.
- **Underlying `kirokuTests` `SWIFT_VERSION` fix** — the workaround lives in
  `fastlane/Snapfile` (`xcargs("SWIFT_VERSION=5.0")`). The root-cause fix
  belongs in a separate PR that edits the `kirokuTests` target in
  `ios/kiroku.xcodeproj`.
- **`testID`s on login + tab bar.** The iOS and Android tests both rely on
  brittle text/index matchers for login fields and bottom-tab buttons. Add
  `testID="loginEmail"`, `testID="loginPassword"`, and `testID="tabSettings"`
  (etc.) to the corresponding RN components in `src/screens/` to make both
  tests resilient to localization + reorder changes.
