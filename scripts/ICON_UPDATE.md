# Updating the App Icon

This project has a single source of truth for the app logo and a script that
regenerates every platform-specific icon and splash-screen asset from it.
Whenever you want to change the icon, follow the steps below.

---

## TL;DR for an AI agent

> Replace `assets/images/app-logo.svg` with the new master SVG (1024×1024
> recommended), then run `npm run generate-icons`. Verify nothing unexpected
> changed with `git status`, then commit. No other manual edits are needed for
> production / dev / adhoc / staging — the script handles every output.

---

## 1. Files involved

### Single source of truth

- [`assets/images/app-logo.svg`](../assets/images/app-logo.svg) — the master
  logo. Square, monochrome (single fill color), 1024×1024.

### Regenerated outputs (do not hand-edit)

| Target | Output |
|---|---|
| iOS app icons | `ios/kiroku/Images.xcassets/AppIcon{,Dev,Staging,AdHoc}.appiconset/*.png` + `Contents.json` |
| iOS boot splash | `ios/kiroku/Images.xcassets/BootSplashLogo{,Dev,Staging,AdHoc}.imageset/*.png` + `Contents.json` |
| Android launcher | `android/app/src/{main,development,staging,adhoc}/res/mipmap-*/ic_launcher{,_background,_foreground,_monochrome}.png` |
| Android adaptive XML | `android/app/src/{main,development,staging,adhoc}/res/mipmap-anydpi-v26/ic_launcher{,_round}.xml` |
| Android boot splash | `android/app/src/{main,development,staging,adhoc}/res/drawable-*/bootsplash_logo.png` |
| Android notifications | `android/app/src/main/res/drawable-*/ic_notification.png` |
| In-app SVG logos | `assets/images/app-logo--{prod,dev,staging,adhoc}.svg` (used by [`src/components/KirokuLogo.tsx`](../src/components/KirokuLogo.tsx)) |
| Web | `web/{favicon.png,apple-touch-icon.png,og-preview-image.png}` |
| Web manifest | `web/manifest.json` (created on first run only; preserved on subsequent runs) |

### Static config you should know about (not regenerated)

- **Splash storyboard:** [`ios/kiroku/BootSplash.storyboard`](../ios/kiroku/BootSplash.storyboard)
  always references `BootSplashLogo` (the production imageset). The dev / staging
  / adhoc imagesets exist but are not currently wired up to per-variant splash
  screens. Doing so requires modifying the storyboard or using build-config
  conditionals — out of scope for the icon refresh.
- **iOS asset catalog selection:** the four `ASSETCATALOG_COMPILER_APPICON_NAME`
  values are set per build configuration in [`project.pbxproj`](../ios/kiroku.xcodeproj/project.pbxproj):
  Debug/Release → `AppIcon`, DebugDevelopment/ReleaseDevelopment → `AppIconDev`,
  DebugAdHoc/ReleaseAdHoc → `AppIconAdHoc`. **DebugStaging / ReleaseStaging do
  not exist yet** — see the manual setup section below if you need staging on iOS.
- **Android flavors:** all four flavors (`production`, `development`, `staging`,
  `adhoc`) are defined in [`android/app/build.gradle`](../android/app/build.gradle).
  Each picks up its icons from its own source-set automatically.

---

## 2. The standard workflow

```bash
# 1. Drop the new master into place (1024×1024 SVG, monochrome).
cp ~/Downloads/new-kiroku-logo.svg assets/images/app-logo.svg

# 2. Regenerate every platform asset.
npm run generate-icons

# 3. Check what changed.
git status --short
git add assets/images/app-logo.svg
git add assets/images/app-logo--*.svg
git add ios/kiroku/Images.xcassets/
git add android/app/src/
git add web/

# 4. Commit.
git commit -m "Update app icon"
```

That is the entire flow for production / dev / staging / adhoc. The script is
idempotent — re-running it produces identical output for an unchanged source SVG.

### Variant badges

Non-production icons get a colored corner triangle so you can tell builds apart:

| Variant | Badge label | Color |
|---|---|---|
| prod | _(no badge)_ | — |
| dev | `DEV` | blue (`#007AFF`) |
| staging | `STG` | orange (`#FF9500`) |
| adhoc | `ADHOC` | purple (`#AF52DE`) |

To change a badge label or color, edit the `VARIANTS` map at the top of
[`scripts/generate-icons.mjs`](generate-icons.mjs).

---

## 3. Manual setup steps (one-time)

These are NOT part of the icon refresh flow — they're things that need to be
done once if you want to enable a feature the icon pipeline depends on.

### Enabling the iOS staging build variant

Right now, `AppIconStaging.appiconset` and `BootSplashLogoStaging.imageset`
exist as Xcode assets, but **no Xcode build configuration references them**.
Until you set this up, the staging icons are present but unused on iOS.

To wire up staging on iOS:

1. Open `ios/kiroku.xcworkspace` in Xcode.
2. Select the project, then the `kiroku` target.
3. Under **Info** → **Configurations**, duplicate `DebugAdHoc` and `ReleaseAdHoc`,
   naming them `DebugStaging` and `ReleaseStaging`. Do the same at the project
   level if Xcode prompts you. (Repeat for the watchOS targets if you ship those.)
4. With the new `DebugStaging` configuration selected for the `kiroku` target,
   open **Build Settings** and set:
   - `ASSETCATALOG_COMPILER_APPICON_NAME` = `AppIconStaging`
   - (Optional) `PROVISIONING_PROFILE_SPECIFIER` for `iphoneos` = `Kiroku_Staging`
     (the profile must exist in the Apple Developer portal).
5. Repeat for `ReleaseStaging`.
6. In **Schemes** → **Manage Schemes**, duplicate `Kiroku (AdHoc)` as
   `Kiroku (staging)` and switch each of its actions (Run, Test, Profile, Analyze,
   Archive) to use the new staging configurations.
7. Run `pod install` — CocoaPods will generate
   `Pods-kiroku.{debug,release}staging.xcconfig` automatically.
8. Add a `.env.staging` file (it is gitignored — see how `.env.adhoc` is provisioned).

After step 8, building the staging scheme will use the orange-badged `AppIconStaging`
icon you generated.

### Provisioning an Android staging flavor

The `staging` flavor is already declared in `build.gradle`. To build it you
need:

1. A `.env.staging` file at the repo root (same shape as `.env.development`).
2. (Optional) Staging-specific Firebase config at `android/app/src/staging/google-services.json`.
   If not provided, the staging flavor falls back to `android/app/src/main/google-services.json`.

Then:

```bash
./gradlew installStagingDebug    # or installStagingRelease
```

### Per-variant boot splash (currently disabled)

The splash storyboard / Android `bootsplash.xml` always render the production
splash. If you want each variant to flash its own badged logo at launch:

- **iOS:** in `ios/kiroku/BootSplash.storyboard`, change the image reference
  from `BootSplashLogo` to a build-setting variable, and wire the variable up
  per configuration. (Apple's recommended pattern is to use a build-setting
  driven `INFOPLIST_KEY_*` or to ship multiple storyboards.)
- **Android:** add density-specific `bootsplash_logo.png` to each variant's
  source set. The script already does this, so per-variant splashes already
  work on Android — no further action needed.

---

## 4. Troubleshooting

**The script says `sharp` is missing.** Run `npm install` from the repo root.
`sharp` is a devDependency and ships native bindings; if `npm install` fails on
macOS, `brew install vips` first, then retry.

**Some icons look stretched or grainy.** The master SVG should be 1024×1024 and
fully filled. If the artwork has internal padding, the script does not crop —
add the padding into the SVG `viewBox` instead.

**The badge text is illegible on small sizes.** That is expected and intentional;
at the smallest iPhone notification size (40×40) the badge is meant to be a color
hint, not readable text. If you need clearer labels, edit `badgeSvg()` in the
script to use a larger triangle or different proportions.

**Xcode shows an "Asset Catalog Compiler" warning about missing iPad sizes.**
The script generates the full iPad icon set. If you see this warning, run
`npm run generate-icons` again — Xcode caches asset catalog state.

**`xUnique` rewrote `project.pbxproj` and the `ASSETCATALOG_COMPILER_APPICON_NAME`
edits got reordered.** That is fine — the values themselves should still be
correct. Verify with:

```bash
grep "ASSETCATALOG_COMPILER_APPICON_NAME" ios/kiroku.xcodeproj/project.pbxproj
```

You should see one `AppIcon`, two `AppIconDev`, two `AppIconAdHoc` (plus
matching entries for the Tests / Watch App targets).
