# Report: Installing the iOS Ad Hoc build alongside the Production build

## Problem

On Android, the **Adhoc** test build and the **Production** build install and run
side by side. On iOS, installing an ad hoc build (the IPA produced by the
`testBuild.yml` workflow → Fastlane `ios build_internal` lane) onto a device that
already has the production App Store build fails: the installer refuses to replace
the existing app.

## Why Android coexists but iOS does not

The two platforms key "is this the same app?" off a single identifier, and Android
already differentiates it while iOS does not.

**Android** — `android/app/build.gradle` gives each flavor a distinct
`applicationId` via a suffix:

```gradle
productFlavors {
    adhoc      { applicationIdSuffix ".adhoc"   }   // com.alcohol_tracker.adhoc
    development{ applicationIdSuffix ".dev"      }
    staging    { applicationIdSuffix ".staging"  }
    // production → com.alcohol_tracker (no suffix)
}
```

Because `com.alcohol_tracker.adhoc` ≠ `com.alcohol_tracker`, Android treats them as
two unrelated apps.

**iOS** — the app's identity is its `CFBundleIdentifier`
(`PRODUCT_BUNDLE_IDENTIFIER`). Today every device configuration of the main app
target resolves to the **same** bundle ID:

```
ios/kiroku.xcodeproj/project.pbxproj
  "PRODUCT_BUNDLE_IDENTIFIER[sdk=iphoneos*]" = "org.reactjs.native.example.alcohol-tracker";
```

This line is identical in the `ReleaseAdHoc` config (used by the `Kiroku (AdHoc)`
scheme / `build_internal` lane) and the `ReleaseProduction` config (used by
`Kiroku (production)` / the `beta` lane). iOS therefore sees the ad hoc IPA as a
*reinstall* of the App Store app. Because the two binaries are signed by different
provisioning profiles (an Ad Hoc distribution profile vs. an App Store profile) and
come from different sources, the install is rejected instead of treated as an
upgrade.

The app icons already differ per config (`AppIconAdHoc` vs `AppIcon`), but the icon
has no bearing on install identity — only the bundle ID does.

## The fix in one sentence

Give the ad hoc configuration its own bundle identifier — e.g.
`org.reactjs.native.example.alcohol-tracker.adhoc` — mirroring Android's `.adhoc`
suffix. The catch is that on iOS a bundle-ID change ripples through code signing,
the embedded Watch app, entitlements/capabilities, Firebase, and Google Sign-In, so
it is more than a one-line edit.

## What has to change

### 1. Xcode project — bundle ID for the AdHoc configs

In `ios/kiroku.xcodeproj/project.pbxproj`, change the device bundle ID for the main
app target's **DebugAdHoc** and **ReleaseAdHoc** configurations only:

```
"PRODUCT_BUNDLE_IDENTIFIER[sdk=iphoneos*]" = "org.reactjs.native.example.alcohol-tracker.adhoc";
```

Leave `Release/DebugProduction` (production) and the other configs untouched. To
keep this DRY, prefer introducing a per-config `BUNDLE_ID_SUFFIX` build setting (or
an `.xcconfig`) so the suffix lives in one place rather than being copy-pasted into
each config block.

### 2. Embedded Apple Watch app — companion linkage (mandatory, not optional)

The Watch app is **embedded** in the phone app (the `Embed Watch Content` build
phase), so the ad hoc archive contains it and its identifiers must stay consistent
or the archive/install fails validation. Two settings, present per-config in the
pbxproj, are derived from the phone bundle ID:

- Watch app `PRODUCT_BUNDLE_IDENTIFIER` = `…alcohol-tracker.watch`
  → for AdHoc must become `…alcohol-tracker.adhoc.watch`
- `COMPANION_IDENTIFIER` = `org.reactjs.native.example.alcohol-tracker`
  → for AdHoc must become `org.reactjs.native.example.alcohol-tracker.adhoc`
  (this feeds `WKCompanionAppBundleIdentifier` in the Watch Info.plist)

So the AdHoc configs of the Watch target need updating too. (Alternative: strip the
Watch target out of the ad hoc build to avoid this work — simpler, but the ad hoc
build then no longer exercises the watch app.)

### 3. Apple Developer portal — new App IDs + Ad Hoc provisioning profile

The current `ios/Kiroku_AdHoc.mobileprovision(.gpg)` is bound to the existing bundle
ID, so a new one is required:

- Register an explicit App ID `org.reactjs.native.example.alcohol-tracker.adhoc`
  (and `…adhoc.watch` if the watch ships in ad hoc builds) with the **same
  capabilities** as today: Push Notifications and Sign in with Apple.
- Generate a new **Ad Hoc** distribution provisioning profile for the new App ID
  (plus a watch profile if applicable), including the test devices.
- These assets are GPG-encrypted in `ios/` and managed by the `ios-signing` skill /
  `scripts/ios-signing.mjs`; extend that tooling to mint and encrypt the new
  profile alongside the existing ones.

### 4. Fastlane `build_internal` lane

In `fastlane/Fastfile`, update the export mapping (and install the new profile):

```ruby
install_provisioning_profile(path: "./ios/Kiroku_AdHoc.mobileprovision")  # new profile
build_app(
  ...
  export_options: {
    method: "ad-hoc",
    provisioningProfiles: {
      "org.reactjs.native.example.alcohol-tracker.adhoc" => "Kiroku_AdHoc",
      # + watch profile mapping if the watch is included
    },
    manageAppVersionAndBuildNumber: false
  }
)
```

### 5. Entitlements / capabilities

`ios/kiroku/kiroku.entitlements` (shared across configs) declares
`aps-environment` (push) and `com.apple.developer.applesignin`. These are fine as
files, but the **new App ID must have Push Notifications and Sign in with Apple
enabled** in the portal or the build will fail to sign / push won't register.

Note: **Sign in with Apple** uses the bundle ID as the client identifier. A new
bundle ID is effectively a new Apple sign-in client, so if the backend validates the
Apple `aud`/client ID it must be taught to accept the `.adhoc` client (or Apple
sign-in will be deferred/excluded from ad hoc builds).

### 6. Firebase / Google Sign-In (the subtle one)

`ios/config/GoogleService-Info.dev.plist` (selected for AdHoc by the
`[User] Copy GoogleService-Info.plist` build phase) is keyed to
`BUNDLE_ID = org.reactjs.native.example.alcohol-tracker`. Firebase matches the
running app's bundle ID against this plist, so with a new bundle ID:

- Register a **new iOS app in the Firebase (dev) project** for
  `…alcohol-tracker.adhoc`, add a `GoogleService-Info.adhoc.plist`, and add an
  `*AdHoc*` case to the copy-plist build phase. Otherwise Crashlytics / Cloud
  Messaging / Analytics registration may fail or misattribute (it works degraded
  for a throwaway test build, but push registration in particular can break).
- **Google Sign-In** relies on the reversed-client-ID URL schemes hardcoded in
  `ios/kiroku/Info.plist` (`CFBundleURLTypes` → `com.googleusercontent.apps.…`). A
  separate Firebase app yields a different `REVERSED_CLIENT_ID`, so the URL scheme
  (and the OAuth client's allowed bundle IDs) must include the ad hoc client or
  Google Sign-In won't complete in the ad hoc build.

### 7. (Optional polish) Distinct display name

The icons already differ. To also label the home-screen text, set a per-config
`INFOPLIST_KEY_CFBundleDisplayName = "Kiroku AdHoc"`. Caveat: `CFBundleDisplayName`
is currently **hardcoded** in `ios/kiroku/Info.plist` (`= Kiroku`); a build-setting
override only takes effect if that hardcoded key is removed (or switched to a
`$(...)` variable) in Info.plist.

## Scope summary

| Area | Change | Mandatory? |
|------|--------|-----------|
| pbxproj — main app AdHoc bundle ID | 2 configs (Debug/Release AdHoc) | Yes |
| pbxproj — Watch bundle ID + `COMPANION_IDENTIFIER` | AdHoc configs, or drop watch from ad hoc | Yes (or exclude watch) |
| Apple portal — new App ID(s) + Ad Hoc profile | new explicit App ID + profile | Yes |
| `ios-signing` tooling | mint/encrypt new profile | Yes |
| Fastfile `build_internal` | profile install + export map | Yes |
| Portal capabilities | Push + Sign in with Apple on new App ID | Yes |
| Firebase | new dev iOS app + `…adhoc.plist` + copy-phase case | Recommended (push/analytics) |
| Google Sign-In URL scheme + OAuth client | adhoc reversed-client-ID | Required only if Google Sign-In must work in ad hoc |
| Display name | per-config `CFBundleDisplayName` | Optional |

## Recommended approach

1. **Minimal viable coexistence:** items 1, 3, 4, 5 — change the AdHoc bundle ID,
   mint the new App ID + Ad Hoc profile, wire up the Fastfile and capabilities. If
   the Watch app is not needed in test builds, exclude it from the ad hoc build to
   skip item 2 entirely.
2. **Full parity:** add item 2 (keep the watch working), item 6 (a dedicated
   Firebase dev app so Crashlytics/messaging/Google Sign-In behave), and item 7
   (a distinct display name).

Most of the effort is the one-time portal/signing setup (App ID, profile, Firebase
app) plus careful per-config pbxproj edits; the code changes themselves are small.
Budget roughly half a day to a day, the bulk of it in Apple Developer / Firebase
console setup and verifying a true side-by-side install on a device.
