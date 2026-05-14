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

A single SVG (`assets/images/app-logo.svg`) is the source of truth. The script
rasterizes it into every platform target — iOS app icon sets (prod / dev /
staging / adhoc), iOS boot splash imagesets, Android mipmap launcher icons +
adaptive XML across four source sets, Android boot splash drawables, Android
notification icons (main only), web favicon / apple-touch-icon / og-preview,
the PWA manifest, and four env-specific in-app SVG logos used by
`src/components/KirokuLogo.tsx`. Non-production variants get a colored corner
triangle badge so dev / staging / adhoc builds are visually distinguishable.

You should be able to handle the vast majority of icon work by running the
script and committing the results. Hand-editing generated files defeats the
purpose and creates drift that the next regeneration silently wipes out.

## Color model (important — don't break this)

The pipeline assumes the master SVG is a **white silhouette on transparent
background**. The script then bakes in the brand background color
(`BRAND_BG = '#F5C400'`, defined at the top of `scripts/generate-icons.mjs`)
on surfaces that must be opaque, and leaves transparency intact on surfaces
that get their backdrop from a separately-configured color resource:

| Surface                                                             | Logo color    | Background                                                           |
| ------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| iOS app icons (`AppIcon*.appiconset/`)                              | white         | baked-in orange (opaque, Apple requires no alpha)                    |
| iOS boot splash (`BootSplashLogo*.imageset/`)                       | white         | transparent — `BootSplash.storyboard` view bg provides orange        |
| Android legacy launcher (`ic_launcher.png`)                         | white         | baked-in orange (older launchers don't composite)                    |
| Android adaptive foreground (`ic_launcher_foreground.png`)          | white         | transparent — composited over `ic_launcher_background.png`           |
| Android adaptive background (`ic_launcher_background.png`)          | —             | solid orange, no logo art                                            |
| Android adaptive monochrome (`ic_launcher_monochrome.png`)          | white shape   | transparent — Android 13+ tints it                                   |
| Android boot splash (`drawable-*/bootsplash_logo.png`)              | white         | transparent — `bootsplash_background` color resource provides orange |
| Android notification (`drawable-*/ic_notification.png`)             | white shape   | transparent — system tints to white/gray                             |
| Web (`favicon.png`, `apple-touch-icon.png`, `og-preview-image.png`) | white         | baked-in orange (renders standalone on arbitrary page chrome)        |
| In-app SVGs (`app-logo--{prod,dev,staging,adhoc}.svg`)              | white in file | tinted at render time by `<ImageSVG fill={theme.appLogo} />`         |

If `BRAND_BG` changes, it must also be updated in:

- `android/app/src/main/res/values/colors.xml` → `bootsplash_background`
- `android/app/src/main/res/values/ic_launcher_background.xml` → `ic_launcher_background`
- `ios/kiroku/BootSplash.storyboard` → root view `backgroundColor` (RGB ≈ 0.961, 0.769, 0 for `#F5C400`)

These four locations must stay in sync. The script does **not** edit them —
it only consumes `BRAND_BG` for the PNGs it generates.

**Why white master, not dark:** in-app `KirokuLogo` renders the SVG through
`expo-image` with `tintColor={theme.appLogo}`, which replaces the entire image
color regardless of the fill in the SVG itself. So the master color doesn't
affect in-app theming — but it does directly determine what color appears in
every rasterized PNG. White is the right default because every PNG surface
either sits on the orange brand background or gets tinted by the OS.

## The standard flow

Always confirm with the user before destructive steps (overwriting the master
SVG, committing). The script itself is idempotent and safe to re-run.

1. **Confirm the master SVG.** Default location:
   `assets/images/app-logo.svg`. If the user is providing new artwork, copy it
   into place first. The art should be square, ideally 1024×1024, and visually
   centered with internal padding baked into the `viewBox` (the script does
   not crop or pad). **The logo silhouette must be white (`#FFFFFF`)** — see
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
   git add assets/images/app-logo.svg \
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

Edit `label` and `color`, then re-run the generator. `color` accepts any CSS
color string; `label` should stay short (2–5 chars) so it remains legible
inside the corner triangle. Setting `badge: null` removes the badge entirely
for a variant.

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

Same as the standard flow, but be deliberate about overwriting
`assets/images/app-logo.svg`. Worth checking with the user first: "Replace the
current master with `<new file>`? This regenerates 100+ icon files." If yes,
copy, run, commit.

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
- The user wants to change the splash-screen background color. That's in
  `ios/kiroku/BootSplash.storyboard` and `android/app/src/main/res/values/colors.xml`,
  not in the icon script.
- The user wants to change the app's display name. That's `INFOPLIST_KEY_CFBundleDisplayName`
  in the pbxproj and `app_name` in Android resources — nothing to do with icons.

If you find yourself opening `scripts/generate-icons.mjs` and the change you
need to make is not on the list under "Common variations" above, stop and
read `scripts/ICON_UPDATE.md` before editing — it has additional context the
skill doesn't cover.
