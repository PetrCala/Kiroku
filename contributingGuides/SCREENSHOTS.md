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
2. Pick a branch (usually `master`) and a `device_subset`:
   - `all` — full matrix (4 devices x 2 locales, ~30-45 min)
   - `phone-only` — 3 iPhones x 2 locales (~20-30 min)
   - `ipad-only` — 1 iPad x 2 locales (~10-15 min, fastest for iterating)
3. When the run finishes, download the `ios-screenshots-<sha>` artifact from
   the workflow summary page. PNGs are organized as
   `ios/<locale>/<device>/*.png`.
4. If the run failed, the `ios-fastlane-logs-<sha>` artifact contains
   `gym`/`snapshot` logs for triage.

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

---

## What this doesn't include (yet)

- **Android CI job** — the `android :screenshots` lane works locally but
  needs the Gradle setup + AVD wiring + manifest permission landed on master
  before it can be lifted into CI. Follow-up.
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
