# Installing the iOS Ad Hoc build alongside the Production build

On **Android**, the `Adhoc` and `Production` flavors install side by side because
`android/app/build.gradle` gives the adhoc flavor `applicationIdSuffix ".adhoc"`
(`com.alcohol_tracker.adhoc` ≠ `com.alcohol_tracker`).

On **iOS**, an app's install identity is its `CFBundleIdentifier`. Until this
change every device configuration resolved to the **same** bundle id
(`org.reactjs.native.example.alcohol-tracker`), so iOS treated the ad hoc IPA as a
_reinstall_ of the App Store app and refused it (different signing / source).

This document describes the implemented fix: the ad hoc build now ships under a
distinct `….adhoc` bundle id, mirroring Android.

## What ships, and what doesn't (important)

The shipping iOS app is the **`kiroku`** target (`product-type.application`,
`kiroku.app`). Both the `Kiroku (AdHoc)` and `Kiroku (production)` schemes build
that target.

There is a second, **orphaned** `Kiroku` target
(`product-type.application.watchapp2-container`, `KirokuContainer.app`) that owns
the `Embed Watch Content` build phase and the Apple Watch app. **No shipping scheme
references it**, so the ad hoc / App Store archives do **not** contain the watch
app. The watch's bundle id / `COMPANION_IDENTIFIER` therefore did **not** need
changing for coexistence — changing them would have been busy-work on a target that
never builds. (If the watch is ever wired into the shipping app, its AdHoc configs
will need `….adhoc.watch` + `COMPANION_IDENTIFIER = ….adhoc` at that time.)

## Implemented changes (repo)

### 1. Xcode project — AdHoc bundle id + display name + signing

`ios/kiroku.xcodeproj/project.pbxproj`, **`kiroku` target, AdHoc configs only**:

- `DebugAdHoc` + `ReleaseAdHoc`:
  `"PRODUCT_BUNDLE_IDENTIFIER[sdk=iphoneos*]" = "….alcohol-tracker.adhoc"`.
- `INFOPLIST_KEY_CFBundleDisplayName = "Kiroku AdHoc"` (home-screen label) for both.
- `DebugAdHoc` switched to `CODE_SIGN_STYLE = Automatic` (was manual, pinned to the
  `Kiroku_Development` profile). `Kiroku_Development` is **shared** by `Debug`,
  `DebugDevelopment` and `DebugProduction`, so it can't be re-pointed to `.adhoc`;
  automatic signing lets local on-device debug runs of the AdHoc scheme provision
  the new id without a committed dev profile. (Several sibling configs already use
  automatic signing.)
- `ReleaseAdHoc` stays **manual** against `Kiroku_AdHoc` (the CI/IPA path) — only
  its bundle id + display name changed.

All `Release/Debug/*Production/*Development` configs are untouched. Production's
display name is still `Kiroku` (every config sets `INFOPLIST_KEY_CFBundleDisplayName`,
so removing the hardcoded `CFBundleDisplayName` from `Info.plist` is value-neutral
for them).

### 2. `Info.plist`

`ios/kiroku/Info.plist`: removed the hardcoded `CFBundleDisplayName` (`Kiroku`) so
the per-config `INFOPLIST_KEY_CFBundleDisplayName` build setting wins (`Kiroku AdHoc`
for ad hoc, `Kiroku` elsewhere). The ad hoc Google reversed-client-id URL scheme
(`com.googleusercontent.apps.806896865950-getgjeb0…`) is added to `CFBundleURLSchemes`
so Google Sign-In completes in the ad hoc build.

### 3. Fastlane

`fastlane/Fastfile` `ios build_internal`: the `export_options.provisioningProfiles`
map key is now `"….alcohol-tracker.adhoc" => "Kiroku_AdHoc"`. The profile **name**
is unchanged (so nothing else in the pipeline moves); only the bundle id it binds to
changed.

### 4. Signing tooling

`scripts/ios-signing.mjs`:

- The `Kiroku_AdHoc` profile now binds to the `….adhoc` id (per-profile bundle id),
  so **every future yearly `renew` stays coexistence-aware** — it will keep minting
  `Kiroku_AdHoc` against `.adhoc`, not the App Store id.
- New `adhoc-setup` command (DRY-RUN unless `--yes`): ensures the `.adhoc` App ID
  exists with **Push Notifications** + **Sign in with Apple**, then mints the
  `Kiroku_AdHoc` ad hoc profile (incl. all enabled devices) against the existing
  valid Apple Distribution cert and re-encrypts `ios/Kiroku_AdHoc.mobileprovision.gpg`.
  It does **not** mint a cert, touch the P12 / `Kiroku` profile, or git-commit.

### 5. Firebase plist selection

`ios/kiroku.xcodeproj/project.pbxproj` `[User] Copy GoogleService-Info.plist`
phase: an `*AdHoc*` case now selects `GoogleService-Info.adhoc.plist`, **falling
back to the dev plist** if that file isn't present, so the ad hoc build never breaks
on a missing plist. `ios/config/GoogleService-Info.adhoc.plist` (dev Firebase iOS app
`1:806896865950:ios:11a4360a6aae76a5b1618f`) is committed.

## One-time console steps

These are the irreversible Apple Developer / Firebase actions. Run them against the
correct team (`L357YP9W28`) and the **dev** Firebase project (`dev-alcohol-tracker-db`).

> **Status — done for the current setup:** App ID `39523ZTDUZ`
> (`org.reactjs.native.example.alcohol-tracker.adhoc`, Push + Sign in with Apple),
> ad hoc profile `Kiroku_AdHoc` `949GBAD675`, and Firebase iOS app
> `1:806896865950:ios:11a4360a6aae76a5b1618f`. The steps below are the reusable runbook.

### Apple Developer — driven by the tooling

```
# Dry-run the plan (no changes):
LARGE_SECRET_PASSPHRASE=… node scripts/ios-signing.mjs adhoc-setup
# Execute (create .adhoc App ID + capabilities, mint Kiroku_AdHoc, re-encrypt .gpg):
LARGE_SECRET_PASSPHRASE=… node scripts/ios-signing.mjs adhoc-setup --yes
```

Then commit the re-encrypted `ios/Kiroku_AdHoc.mobileprovision.gpg`. (If the ASC API
key lacks Admin rights to create an App ID, create
`org.reactjs.native.example.alcohol-tracker.adhoc` manually in
Identifiers → +, enable Push + Sign in with Apple, then re-run `adhoc-setup`.)

### Firebase (dev project)

1. Register a **new iOS app** in `dev-alcohol-tracker-db` for the bundle id
   `org.reactjs.native.example.alcohol-tracker.adhoc`.
2. Download its `GoogleService-Info.plist` → commit as
   `ios/config/GoogleService-Info.adhoc.plist`.
3. Add the new app's `REVERSED_CLIENT_ID` to `CFBundleURLSchemes` in
   `ios/kiroku/Info.plist`, and make sure the Google OAuth iOS client accepts the
   `.adhoc` bundle id — otherwise Google Sign-In won't complete in ad hoc.

### Backend — Apple Sign-In `aud`

Sign in with Apple uses the bundle id as the client id. **No backend change is
needed for Kiroku:** `kiroku-api` does not validate the Apple `aud`/client (auth is
Firebase-gated), and Apple sign-in is Firebase-native, so registering the `.adhoc`
iOS app in Firebase (above) is what makes the `.adhoc` `aud` acceptable. (If a future
backend ever validates the Apple client, teach it to accept `….adhoc`.)

## Definition of done

- An ad hoc build installs and launches alongside the production App Store build,
  both visible (distinct `AppIconAdHoc` icon + `Kiroku AdHoc` label).
- Production build/signing is unaffected.
- Push + Google/Apple sign-in work in the ad hoc build (after Phase 2).
