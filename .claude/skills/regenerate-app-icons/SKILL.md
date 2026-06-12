---
name: regenerate-app-icons
description: Regenerate every Kiroku app icon, boot splash, notification icon, in-app SVG, and web favicon from the master SVG using the single-source generation script. Use this skill whenever the user wants to update the app logo, replace the master art, change the badge colors or labels on variant icons (DEV / STG / ADHOC), add a new build variant's icon set, tweak which sizes get generated, or otherwise refresh the visual brand on iOS / Android / web. Trigger even when the user phrases it indirectly — e.g. "update the icon", "swap the logo", "change the staging badge", "make the dev icon orange", "I need new app store assets", "rerun the icon thing". This is the project's only sanctioned way to touch icon assets; do not hand-edit `*.appiconset/`, `mipmap-*/`, or `drawable-*/` files.
---

# Regenerate App Icons (Kiroku)

This skill drives the icon-generation pipeline rooted at
[`scripts/generate-icons.mjs`](../../../scripts/generate-icons.mjs). The full
human-readable reference lives at
[`scripts/ICON_UPDATE.md`](../../../scripts/ICON_UPDATE.md) — open it when you
need details the skill doesn't cover (e.g. wiring up iOS staging in Xcode).

## What "regenerate icons" means here

Three committed SVG masters are the source of truth, all emitted by the
parametric builder `assets/design/mascot/build-masters.mjs` (edit geometry
there, not the SVGs):

- `assets/images/app-logo.svg` — full-color mascot, **full cut** (tilted
  writing pose) → boot splashes, in-app env logos, og preview.
- `assets/images/app-icon.svg` — full-color mascot, **icon cut** (upright,
  tighter) → app icons, adaptive foreground vector, favicon, apple-touch-icon.
- `assets/images/app-logo-silhouette.svg` — white silhouette, face as evenodd
  holes → Android notification icons + themed-icon monochrome.

The script rasterizes these into every platform target — iOS app icon sets
(prod / dev / staging / adhoc), iOS boot splash imagesets, Android adaptive
icon foregrounds as **Vector Drawable XML** (one per flavor), Android legacy
launcher PNGs across four source sets, the per-prod themed-icon monochrome
PNG, Android boot splash drawables, Android notification icons (main only),
web favicon / apple-touch-icon / og-preview, the PWA manifest, and four
env-specific in-app SVG logos inlined into the web boot splash. Non-production
variants get a colored corner triangle badge so dev / staging / adhoc builds
are visually distinguishable; the badge label is baked to glyph paths via
`text-to-svg` so the same geometry drives both raster outputs and the Vector
Drawable XMLs.

You should be able to handle the vast majority of icon work by running the
script and committing the results. Hand-editing generated files defeats the
purpose and creates drift that the next regeneration silently wipes out.

## Color model (important — don't break this)

The masters are **full-color flat art** — the mascot's pencil body carries the
brand yellow, so opaque surfaces composite onto the dark icon backdrop
(`ICON_BG = '#0D1117'`, defined at the top of `scripts/generate-icons.mjs`
and synced from `brandSplashBg` in `src/styles/theme/colors.ts` via
`scripts/sync-brand-colors.mjs`). Surfaces that the OS tints through the alpha
channel use the white silhouette master instead (face as holes — a colored
face would vanish into the tint; `assertSilhouette()` enforces pure white):

| Surface                                                                           | Source                  | Background                                                        |
| --------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| iOS app icons (`AppIcon*.appiconset/`)                                            | icon cut, full color    | baked-in `ICON_BG` (opaque, Apple requires no alpha)              |
| iOS boot splash (`BootSplashLogo*.imageset/`)                                     | full cut, full color    | transparent — `BootSplash.storyboard` view bg provides `ICON_BG`  |
| Android legacy launcher (`mipmap-*/ic_launcher.png`, Android &lt; 8)              | icon cut, full color    | baked-in `ICON_BG` (older launchers don't composite)              |
| Android adaptive foreground (`drawable/ic_launcher_foreground.xml`)               | icon cut, full color    | transparent — vector XML, sits on `@color/ic_launcher_background` |
| Android adaptive background                                                       | —                       | `@color/ic_launcher_background` resource (no PNG)                 |
| Android themed-icon monochrome (`drawable/ic_launcher_monochrome.png`, prod only) | silhouette (face holes) | transparent — Android 13+ Themed Icons tints it                   |
| Android boot splash (`drawable-*/bootsplash_logo.png`)                            | full cut, full color    | transparent — `bootsplash_background` color resource provides it  |
| Android notification (`drawable-*/ic_notification.png`)                           | silhouette (face holes) | transparent — system tints to white/gray                          |
| Web `favicon.png` / `apple-touch-icon.png`                                        | icon cut, full color    | baked-in `ICON_BG` (renders standalone on arbitrary page chrome)  |
| Web `og-preview-image.png`                                                        | full cut, full color    | baked-in `ICON_BG`                                                |
| In-app SVGs (`app-logo--{prod,dev,staging,adhoc}.svg`)                            | full cut, full color    | rendered as-is — **no theme tinting** (web splash, splash hider)  |

## Android canvas specs (important — don't conflate them)

Android adaptive icons are now driven by a vector XML foreground (one per
flavor) plus a color-resource background, mirroring Expensify's pipeline.
The legacy 48dp `ic_launcher.png` is still rasterized per density as a
fallback for pre-Android-8 launchers. The boot splash is still a raster.
The constants below encode the canvas sizes; the same `ADAPTIVE_SAFE_ZONE`
that used to crop foreground PNGs now sets the outer `<group>` scale +
translate inside the vector XML.

| Surface                                                       | Canvas (1× base) | Art occupies | Why                                                                                                                           |
| ------------------------------------------------------------- | ---------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `mipmap-*/ic_launcher.png` (legacy launcher, per density)     | 48dp             | 100%         | Pre-Android-8 launchers don't apply masks; the PNG is the icon                                                                |
| `drawable/ic_launcher_foreground.xml` (vector, per flavor)    | 108dp viewport   | inner 60%    | Launcher applies its mask shape; corners outside the 66dp safe zone may be clipped                                            |
| `@color/ic_launcher_background` (resource, shared)            | n/a              | n/a          | Solid `BRAND_BG` from `values/ic_launcher_background.xml`                                                                     |
| `drawable/ic_launcher_monochrome.png` (single PNG, prod only) | 432px (xxxhdpi)  | inner 60%    | Themed-icons silhouette; Android scales the single PNG down per density                                                       |
| `bootsplash_logo.png` (per density)                           | 288dp            | inner ~37%   | react-native-bootsplash default; matches Android 12+ `windowSplashScreenAnimatedIcon` and stays inside the 192dp visible area |

The script encodes these in `ANDROID_DENSITIES` (`iconSize` / `foreSize` /
`splashSize`), `ANDROID_MONOCHROME_PNG_SIZE`, `ADAPTIVE_SAFE_ZONE`, and
`ANDROID_SPLASH_INNER_SCALE`. If you find yourself rendering the legacy
launcher at `d.foreSize` or the splash at `d.iconSize`, stop — that's the
original bug.

`renderIcon()` takes an `innerScale` option for the inset PNG surfaces.
`svgToVectorDrawable()` applies the same scale via an outer `<group>` and
appends badge paths inside it, so the badge stays inside the safe zone
alongside the art (matching the raster pipeline's behavior).

### Why the flavor variants drop `<monochrome>`

Android 13+'s **Settings → Wallpaper & style → Themed icons** replaces the
adaptive foreground with a tinted silhouette derived from the `<monochrome>`
layer. If we included it on the `development` / `staging` / `adhoc`
adaptive-icon XMLs, all four builds would render the same tinted K when
Themed Icons is enabled — erasing the corner badge that distinguishes them.
Only prod includes the layer; flavor variants fall back to standard
colored adaptive rendering on themed devices.

### Supported SVG subset

The SVG-to-Vector-Drawable converter inside `scripts/generate-icons.mjs`
accepts only `<path>` and `<rect>` elements, with a literal hex `fill` and
at most a single `transform="rotate(angle cx cy)"` on a `<rect>`. Gradients,
masks, `<defs>`, nested `<g>`, named CSS colors, percentage units, `<text>`,
**stroked elements, and fill-less elements** all fail with a precise error
message naming the offending construct (a silently skipped element would
drop art — e.g. a face feature — from the launcher icon). If a master SVG
change makes the script throw, that's the safety net firing — regenerate via
`assets/design/mascot/build-masters.mjs`, which bakes strokes and round
shapes to filled paths, or extend `svgToVectorDrawable()`.

## Backdrop color sync

The backdrop is single-sourced: `brandSplashBg` in
`src/styles/theme/colors.ts`. To change it, edit that one line and run
`node scripts/sync-brand-colors.mjs`, which propagates it to:

- `android/app/src/main/res/values/colors.xml` → `bootsplash_background`
- `android/app/src/main/res/values/ic_launcher_background.xml` → `ic_launcher_background`
- `ios/kiroku/BootSplash.storyboard` → root view `backgroundColor`
- `scripts/generate-icons.mjs` → `ICON_BG`
- `web/index.html` → `theme-color` meta + `#splash` background

Then rerun `npm run generate-icons` so the baked-in PNG backgrounds match.
Never hand-edit those targets individually; `sync-brand-colors.mjs --check`
flags drift.

**Why a silhouette master exists:** Android tints notification and
themed-icon art uniformly through the alpha channel, so the mascot's dark
face features would vanish into the tint. The silhouette master cuts the face
out as evenodd holes instead — that's a design decision, which is why it's a
separate checked-in source and not something the script derives from the
color art.

## The standard flow

Always confirm with the user before destructive steps (overwriting the master
SVG, committing). The script itself is idempotent and safe to re-run.

1. **Confirm the masters.** The three SVGs in `assets/images/` are emitted by
   `assets/design/mascot/build-masters.mjs` — if the artwork is changing, edit
   the geometry there and run the builder rather than hand-editing or copying
   foreign SVGs into place. All three must stay square 1024×1024, fill-only
   `<path>`/`<rect>`, no strokes; the silhouette must stay pure white — see
   "Color model" above.

2. **Run the generator.** From the repo root:

   ```bash
   npm run generate-icons
   ```

   Expected output ends with `Done. All icons generated successfully.` and
   takes a few seconds. If you see `Cannot find module 'sharp'`, run
   `npm install` first — `sharp` is a devDependency.

3. **Inspect the diff.** Use `git status --short` to see what changed. Expect
   to see:

   - A small set of modifications inside `ios/kiroku/Images.xcassets/`
   - Modifications across `android/app/src/{main,development,staging,adhoc}/res/`
   - Modifications under `web/`
   - Modifications to `assets/images/app-logo--{prod,dev,staging,adhoc}.svg`
   - If only the master art changed, you may see a hundred-plus files modified
     — this is normal; every rasterized size regenerates.

4. **Spot-check at least one icon.** `file
ios/kiroku/Images.xcassets/AppIcon.appiconset/AppIcon~ios-marketing.png`
   should report a 1024×1024 PNG. Open it in Preview if the user wants visual
   confirmation. If the new art looks compressed or stretched, the source SVG
   likely lacks the right `viewBox` — flag this rather than continuing.

5. **Stage and commit (with user confirmation).** Stage explicitly — do not
   `git add -A` because that picks up `tsconfig.tsbuildinfo`:
   ```bash
   git add assets/design/mascot/ \
           assets/images/app-logo.svg \
           assets/images/app-icon.svg \
           assets/images/app-logo-silhouette.svg \
           assets/images/app-logo--*.svg \
           ios/kiroku/Images.xcassets/ \
           android/app/src/ \
           web/
   ```
   If `scripts/generate-icons.mjs` itself changed (badge tweak, new size,
   etc.), include it too.

## Common variations

### Changing badge colors or labels

The variant table lives at the top of `scripts/generate-icons.mjs` in the
`VARIANTS` const:

```js
const VARIANTS = {
  prod: {badge: null},
  dev: {badge: {label: 'DEV', color: '#007AFF'}},
  staging: {badge: {label: 'STG', color: '#FF9500'}},
  adhoc: {badge: {label: 'ADHOC', color: '#AF52DE'}},
};
```

Edit `label` and `color`, then re-run the generator. `color` must be a
literal hex string (`#RRGGBB` or `#AARRGGBB`) — named CSS colors and
`rgb()`/`hsl()` are rejected by the Vector Drawable converter, so only the
raster surfaces would accept them. `label` should stay short (2–5 chars) so
it remains legible inside the corner triangle; the label is rendered as path
data via `text-to-svg` + the bundled `ExpensifyNeue-Bold.otf`, so it does
not depend on whatever system font happens to exist on the build machine.
Setting `badge: null` removes the badge entirely for a variant.

### Adding a new build variant

This is more than an icon change — the new variant also needs a build
configuration on each platform before its icons are actually used. Adding to
the icon pipeline is straightforward:

1. Add an entry to `VARIANTS` in `scripts/generate-icons.mjs`.
2. Add an entry to `IOS_VARIANT_ASSET` (the asset-catalog name, e.g.
   `'AppIconBeta'`).
3. Add an entry to `IOS_SPLASH_ASSET` (the boot-splash imageset name).
4. Add an entry to `ANDROID_VARIANT_SRC` (the Android source-set folder, e.g.
   `'beta'`).
5. Run `npm run generate-icons`.
6. Tell the user that wiring the new variant into builds is a separate task:
   on iOS, that means a new Xcode build configuration + scheme + (usually) a
   provisioning profile; on Android, a new `productFlavor` in
   `android/app/build.gradle` plus `.env.<variant>` and possibly
   `google-services.json`. Point them at the corresponding section of
   `scripts/ICON_UPDATE.md`.

### Replacing the master art entirely

Same as the standard flow, but be deliberate: rework
`assets/design/mascot/build-masters.mjs` (or replace it alongside the three
masters it emits), keeping the fill-only/no-stroke constraints. Worth checking
with the user first: "Replace the current masters? This regenerates 100+ icon
files." If the in-app logo art changes shape, the mirrored paths in
`src/components/KirokuLogo/logoShapes.ts` must be updated in the same change —
a unit test asserts parity with `app-logo.svg`.

### Tweaking which sizes get generated

The `IOS_ICON_SPECS`, `ANDROID_DENSITIES`, `ANDROID_NOTIF_DENSITIES`, and
`WEB_SPECS` constants in the script enumerate every output size. Removing
entries leaves stale files behind on disk — call this out and run the
generator after editing; you may also need to `git rm` the orphaned files.

## Pitfalls and things to know

- **`tsconfig.tsbuildinfo` is gitignored but already-tracked**, so it shows up
  as modified after typecheck runs. Do not include it in icon commits.
- **The PNG inside `AppIconAdHoc.appiconset/` is named `AppIconAdHoc-*.png`,
  not `AppIconAdhoc-*.png`.** The script uses the `IOS_VARIANT_ASSET` mapping
  to keep filename casing consistent with the asset-catalog directory name.
  Filenames inside `appiconset` directories don't _have_ to match, but Xcode
  shows warnings when they drift, and the script enforces consistency.
- **The script cleans PNGs out of each `appiconset` and `imageset` before
  regenerating.** This is intentional — it prevents stale legacy filenames
  from lingering. Don't store unrelated PNGs inside those directories.
- **iOS staging icons exist but are not selected by any iOS build
  configuration yet.** Wiring `AppIconStaging` into Xcode is documented as a
  manual step in `scripts/ICON_UPDATE.md`. If the user asks why their staging
  iOS build still shows the production icon, this is the answer.
- **xUnique can re-shuffle the pbxproj** during `pod install`. The four
  `ASSETCATALOG_COMPILER_APPICON_NAME` settings (DebugDevelopment +
  ReleaseDevelopment → `AppIconDev`, DebugAdHoc + ReleaseAdHoc →
  `AppIconAdHoc`) are stable line edits and should survive a reshuffle, but
  it's worth verifying with:
  ```bash
  grep "ASSETCATALOG_COMPILER_APPICON_NAME" ios/kiroku.xcodeproj/project.pbxproj
  ```
  Expect at least one each of `AppIcon`, `AppIconDev`, `AppIconAdHoc` on the
  iOS main target's configurations.
- **The boot-splash storyboard always references the production `BootSplashLogo`
  imageset.** The dev / staging / adhoc imagesets are generated but
  unreferenced on iOS. Don't promise the user that their dev iOS build will
  show a badged splash unless they've separately wired that up.
- **Android per-flavor source sets handle icon selection through Gradle**, so
  dev / staging / adhoc Android builds genuinely do pick up their badged
  variants — no extra wiring needed.

## When NOT to use this skill

- The user wants to edit individual SVG icons inside `assets/images/` that
  aren't the app logo (e.g. `KirokuIcons` UI glyphs). Those are not part of
  the generation pipeline.
- The user wants to change the splash-screen background color. That's
  `brandSplashBg` in `src/styles/theme/colors.ts` + `node
scripts/sync-brand-colors.mjs` (see "Backdrop color sync"), not a direct
  icon-script edit — though you should rerun the generator afterwards.
- The user wants to change the app's display name. That's `INFOPLIST_KEY_CFBundleDisplayName`
  in the pbxproj and `app_name` in Android resources — nothing to do with icons.

If you find yourself opening `scripts/generate-icons.mjs` and the change you
need to make is not on the list under "Common variations" above, stop and
read `scripts/ICON_UPDATE.md` before editing — it has additional context the
skill doesn't cover.
