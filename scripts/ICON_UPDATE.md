# Updating the App Icon

This project has a single source of truth for the app logo and a script that
regenerates every platform-specific icon and splash-screen asset from it.
Whenever you want to change the icon, follow the steps below.

---

## TL;DR for an AI agent

> The masters are built from parametric geometry: edit
> `assets/design/mascot/build-masters.mjs`, run it to refresh the three SVGs in
> `assets/images/` (`app-logo.svg`, `app-logo-splash.svg`, `app-logo-silhouette.svg`),
> then run `npm run generate-icons`. Verify nothing unexpected changed with
> `git status`, then commit. No other manual edits are needed for production /
> dev / adhoc / staging — the script handles every output. If the in-app logo
> art changed shape, mirror it into
> `src/components/KirokuLogo/logoShapes.ts` (a unit test locks the parity).

---

## 1. Files involved

### Sources of truth

All three masters are square 1024×1024, restricted to `<path>`/`<rect>` with
literal hex fills (no strokes, gradients, groups, or circle/ellipse elements),
and are emitted by
[`assets/design/mascot/build-masters.mjs`](../assets/design/mascot/build-masters.mjs)
— edit the geometry there, not the SVGs.

- [`assets/images/app-logo.svg`](../assets/images/app-logo.svg) — the mascot
  (tilted writing pose, full color). Drives the app icons, the adaptive
  foreground vector, favicon, apple-touch-icon, the og preview image,
  `app-logo.png` (the README raster), and the in-app logo (`logoShapes.ts`
  mirrors it).
- [`assets/images/app-logo-splash.svg`](../assets/images/app-logo-splash.svg)
  — the same mascot on a **white rounded chip**. Drives the boot splashes and
  the env splash logos: the splash backdrop is the brand yellow, which the
  bare pencil body (also brand yellow) would vanish into, so the splash logo
  carries its own white field — it reads as the app icon the user just tapped.
- [`assets/images/app-logo-silhouette.svg`](../assets/images/app-logo-silhouette.svg)
  — an upright stubby cut as a **pure-white silhouette** with the face cut out
  as evenodd holes. Drives the Android notification icons and the Android 13+
  themed-icon monochrome layer, both of which the OS tints through the alpha
  channel (the script's `assertSilhouette()` rejects any non-white fill). It
  deliberately differs from the tilted pose: at 24dp the tilted slim pencil's
  face holes close up.

See [Color model](#color-model) for the per-surface table.

### Regenerated outputs (do not hand-edit)

| Target                         | Output                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS app icons                  | `ios/kiroku/Images.xcassets/AppIcon{,Dev,Staging,AdHoc}.appiconset/*.png` + `Contents.json`                                                                                 |
| iOS boot splash                | `ios/kiroku/Images.xcassets/BootSplashLogo{,Dev,Staging,AdHoc}.imageset/*.png` + `Contents.json`                                                                            |
| Android legacy launcher (PNG)  | `android/app/src/{main,development,staging,adhoc}/res/mipmap-*/ic_launcher.png` (pre-Android-8 fallback only)                                                               |
| Android adaptive foreground    | `android/app/src/{main,development,staging,adhoc}/res/drawable/ic_launcher_foreground.xml` (vector, badge baked into per-flavor variants)                                   |
| Android adaptive background    | `@color/ic_launcher_background` from [`values/ic_launcher_background.xml`](../android/app/src/main/res/values/ic_launcher_background.xml) — not regenerated, see brand sync |
| Android themed-icon monochrome | `android/app/src/main/res/drawable/ic_launcher_monochrome.png` (single PNG, prod only — flavor variants drop the monochrome layer)                                          |
| Android adaptive XML           | `android/app/src/{main,development,staging,adhoc}/res/mipmap-anydpi-v26/ic_launcher.xml` (prod includes `<monochrome>`; flavors omit it)                                    |
| Android boot splash            | `android/app/src/{main,development,staging,adhoc}/res/drawable-*/bootsplash_logo.png`                                                                                       |
| Android notifications          | `android/app/src/main/res/drawable-*/ic_notification.png`                                                                                                                   |
| In-app SVG logos               | `assets/images/app-logo--{prod,dev,staging,adhoc}.svg` (used by [`src/components/KirokuLogo.tsx`](../src/components/KirokuLogo.tsx))                                        |
| Web                            | `web/{favicon.png,apple-touch-icon.png,og-preview-image.png}`                                                                                                               |
| Web manifest                   | `web/manifest.json` (created on first run only; preserved on subsequent runs)                                                                                               |
| Brand raster (README)          | `assets/images/app-logo.png` (1024×1024 mascot on the white icon field; embedded by the GitHub README)                                                                      |

#### Android themed icons (the prod-only monochrome decision)

Android 13+ exposes a system setting (**Settings → Wallpaper & style → Themed
icons**) that lets the user replace adaptive-icon foregrounds with a single
tinted silhouette derived from `<monochrome>`. Production opts in; the
`development` / `staging` / `adhoc` flavors deliberately omit `<monochrome>`
from their adaptive XML.

If we included it on the flavor variants, enabling Themed Icons would erase
the corner badge — every build would render the same tinted K, making it
impossible to tell dev / staging / adhoc apart on the launcher. Dropping the
layer keeps the colored adaptive rendering on themed devices instead.

#### Supported SVG subset (the converter's allow-list)

The SVG-to-Vector-Drawable converter inside `scripts/generate-icons.mjs`
accepts a deliberately small subset of SVG so output stays predictable and
deterministic: `<path>` and `<rect>` elements with a literal hex `fill`, and
at most a single `transform="rotate(angle cx cy)"` on a `<rect>`. Gradients,
masks, `<defs>`, nested `<g>` groups, CSS styles, percentage units, named
CSS colors, and `<text>` are all rejected with a precise error message
naming the offending construct.

If you change `assets/images/app-logo.svg` and the script throws on regen,
that's the safety net firing — either edit the SVG back into the supported
subset, or extend `svgToVectorDrawable()` in the script.

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
# 1. Update the mascot geometry and rebuild the three masters.
$EDITOR assets/design/mascot/build-masters.mjs
node assets/design/mascot/build-masters.mjs

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

### Color model

The masters are **full-color flat art** — the mascot's pencil body carries the
brand yellow itself, so the icon field is white
(`ICON_BG = '#FFFFFF'`, defined at the top of
[`scripts/generate-icons.mjs`](generate-icons.mjs); the foam's soft contour
keeps the white foam legible on it). The boot splash keeps the **brand-yellow
backdrop** and renders the chip master, which carries its own white field. The
one single-color exception is the silhouette master, used where the OS tints
art through its alpha channel:

| Surface                                     | Source                  | Background                                                             |
| ------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| iOS app icons                               | mascot, full color      | baked `ICON_BG` white (Apple requires opaque)                          |
| iOS boot splash                             | chip master             | transparent — storyboard view bg provides the brand yellow             |
| Android legacy launcher (`ic_launcher.png`) | mascot, full color      | baked `ICON_BG` white                                                  |
| Android adaptive foreground (vector XML)    | mascot, full color      | transparent (vector keeps per-path fills)                              |
| Android adaptive background                 | —                       | solid `ICON_BG` white via `@color/ic_launcher_background`              |
| Android themed-icon monochrome (prod only)  | silhouette (face holes) | transparent (OS tints when Themed Icons is enabled)                    |
| Android boot splash                         | chip master             | transparent — `bootsplash_background` provides the brand yellow        |
| Android notification icons                  | silhouette (face holes) | transparent (system tints)                                             |
| Web favicon / apple-touch / og-preview      | mascot, full color      | baked `ICON_BG` white                                                  |
| Splash `app-logo--*.svg`                    | chip master             | rendered as-is (no theme tinting) on web splash + Android splash hider |

#### If you change a backdrop color

Two tokens in `src/styles/theme/colors.ts` drive the backdrops, synced by
`node scripts/sync-brand-colors.mjs`:

- `yellowStrong` (splash) → `colors.xml` (`bootsplash_background`), the
  `BootSplash.storyboard` root view color, and the `theme-color` meta +
  `#splash` background in `web/index.html`.
- `brandIconBg` (icons) → `ic_launcher_background.xml` and the `ICON_BG`
  constant in `generate-icons.mjs`.

Edit the token, run the sync script, then rerun `npm run generate-icons` so
the baked PNGs match. Hand-editing any of those files individually will flash
a mismatched color at launch (and `sync-brand-colors.mjs --check` will flag it).

#### Why the silhouette master exists

Android tints notification and themed-icon art uniformly through the alpha
channel — colored fills don't survive, and the mascot's dark face features
would simply vanish into the tint. The silhouette master therefore cuts the
face out as evenodd _holes_ so it stays legible after tinting. That's a design
decision, not a mechanical recolor, which is why it's a separate checked-in
source rather than something the script derives.

### Variant badges

Non-production icons get a colored corner triangle so you can tell builds apart:

| Variant | Badge label  | Color              |
| ------- | ------------ | ------------------ |
| prod    | _(no badge)_ | —                  |
| dev     | `DEV`        | blue (`#007AFF`)   |
| staging | `STG`        | orange (`#FF9500`) |
| adhoc   | `ADHOC`      | purple (`#AF52DE`) |

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
hint, not readable text. If you need clearer labels, edit `badgeGeometry()` in the
script to use a larger triangle or different proportions.

**The script throws "unsupported element", "unsupported color", "uses
stroke", or "has no fill" when I run it.** That's the SVG-to-Vector-Drawable
converter rejecting a construct in `assets/images/app-logo.svg` it doesn't
recognize. See the "Supported SVG subset" note above — gradients, masks,
`<defs>`, nested `<g>`, named CSS colors, `<text>`, strokes, and fill-less
elements are all rejected by design (a silently skipped element would drop
art from the launcher icon). Regenerate the masters via
`assets/design/mascot/build-masters.mjs`, which bakes everything to filled
paths, or extend `svgToVectorDrawable()` to handle the new construct.

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
