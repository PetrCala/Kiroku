# Store screenshots — local setup

Fastlane `snapshot` (iOS) + `screengrab` (Android) capture App Store / Play Store
screenshots across the device + locale matrix declared in
[`fastlane/Snapfile`](../fastlane/Snapfile) and
[`fastlane/Screengrabfile`](../fastlane/Screengrabfile).

This is **scaffolding** — the configuration and UI test code is in place, but a
few manual steps are required before the first run will succeed. Treat this PR
as the foundation; expect to iterate on the UI test selectors against the live
app the first time you run it.

---

## Prerequisites

Set demo credentials in your shell (a real Kiroku account with at least one
recorded session, so screenshots have content):

```bash
export APPLE_DEMO_EMAIL="..."
export APPLE_DEMO_PASSWORD="..."
export KIROKU_DEMO_EMAIL="$APPLE_DEMO_EMAIL"
export KIROKU_DEMO_PASSWORD="$APPLE_DEMO_PASSWORD"
```

---

## iOS — one-time setup

1. **Add a UI Testing Bundle target in Xcode.** Open
   `ios/kiroku.xcworkspace`, then **File → New → Target → UI Testing Bundle**.
   Name it exactly `KirokuUITests`, set the target to be tested to
   `Kiroku (production)`. This step **must** be done in Xcode — editing
   `project.pbxproj` by hand is risky.

2. **Drag `ios/KirokuUITests/ScreenshotTests.swift`** into the new target.

3. **Generate `SnapshotHelper.swift`:**

   ```bash
   bundle exec fastlane snapshot init
   ```

   It drops `SnapshotHelper.swift` in the repo root — move it into
   `ios/KirokuUITests/` and add it to the test target.

4. **Edit the `Kiroku (production)` scheme** → Test action → add the
   `KirokuUITests` target. Make sure **Run tests in parallel** is OFF (snapshot
   is sequential).

5. **Run:**
   ```bash
   bundle exec fastlane ios screenshots
   ```
   First run takes ~15–20 min (boots 4 simulators × 2 locales). Output lands in
   `fastlane/screenshots/ios/<locale>/<device>/*.png`.

---

## Android — one-time setup

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

3. **Boot the AVD you want to capture against** (a Pixel 7 emulator is a good
   default for the phone bucket):

   ```bash
   emulator -avd Pixel_7_API_34
   ```

4. **Run:**
   ```bash
   bundle exec fastlane android screenshots
   ```

---

## Known gaps the first run will surface

The UI test code in
[`ios/KirokuUITests/ScreenshotTests.swift`](../ios/KirokuUITests/ScreenshotTests.swift)
and
[`android/app/src/androidTest/.../ScreenshotTest.kt`](../android/app/src/androidTest/java/com/alcohol_tracker/screenshots/ScreenshotTest.kt)
makes a few assumptions that may need adjustment after you watch the first run
in the simulator:

- **Inputs lack `testID`s.** The login fields are matched by `firstMatch` on
  text/secure text fields. If a future screen change reorders them, login
  breaks. Long-term fix: add `testID="loginEmail"` / `testID="loginPassword"`
  on the inputs in `src/screens/SignUp/AuthScreen.tsx`.

- **Bottom tab bar buttons lack `testID`s.** Matched by their localized labels
  (`"Start"`, `"Settings"`, `"Nastavení"`…). If translations change in
  [`src/languages/en.ts`](../src/languages/en.ts) or
  [`src/languages/cs_cz.ts`](../src/languages/cs_cz.ts), update the matcher
  arrays in the test files to match.

- **Submit button labels.** Same story — matched on `"Log In"` /
  `"Přihlásit se"`. Update if the strings change.

- **Calendar day cells.** The test taps the first element with the accessibility
  identifier `DayMarking`. If your demo account has no recorded sessions, this
  selector will fail — make sure the demo account has at least one logged
  session in the current month.

- **In-app locale switch flow.** The test navigates
  Settings → Preferences → Language → (Czech/English). If the menu structure
  changes, update `switchLocaleIfNeeded()` in both test files.

The pragmatic path: run it once, watch which step fails, either tweak the
matcher or add a `testID` to the underlying RN component. Each round of
iteration is cheap — single device, single locale — once the flow is stable,
the full matrix runs unattended.

---

## What this doesn't include (yet)

- **CI workflow** — `screenshots.yml` is a planned follow-up PR. Once the local
  flow is reliable, lifting it into a `workflow_dispatch`-triggered job is
  ~50 lines of YAML.
- **`frameit` device bezels** — uncomment the line in the iOS lane once you've
  installed it (`bundle exec fastlane frameit setup`).
- **Auto-upload to App Store Connect / Play Console** — both lanes currently
  stop after capturing PNGs. Wiring them into the existing `production` lanes
  via `deliver` / `supply` with `skip_screenshots: false` is the natural next
  step once you trust the output.
