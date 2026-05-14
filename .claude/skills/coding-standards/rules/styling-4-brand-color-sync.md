---
ruleId: STYLING-4
title: Brand color edits go through the sync script
---

## [STYLING-4] Brand color edits go through the sync script

### Reasoning

The brand color (`#F5C400`) is hard-coded in five different files because each platform consumes color in a different format (TypeScript hex, Android XML, iOS storyboard RGB floats, raster-bake constant). The single source of truth is `yellowStrong` in [`src/styles/theme/colors.ts`](src/styles/theme/colors.ts); the other four files must be updated by running `npm run sync-brand-colors`, which performs the format conversion correctly. Hand-editing any of the four targets risks drift between the boot splash, app icons, and runtime theme.

### Incorrect

```diff
# ios/kiroku/BootSplash.storyboard
- <color key="backgroundColor" red="0.9607843" green="0.76862745" blue="0" alpha="1" ...
+ <color key="backgroundColor" red="0.8" green="0.5" blue="0.3" alpha="1" ...
```

```diff
# scripts/generate-icons.mjs
- const BRAND_BG = '#F5C400';
+ const BRAND_BG = '#CC8744';
```

These edits are isolated — the runtime theme and other platform files still reference the old yellow, producing a launch experience that flashes one color before settling on another.

### Correct

```diff
# src/styles/theme/colors.ts
- yellowStrong: '#F5C400',
+ yellowStrong: '#CC8744',
```

```bash
npm run sync-brand-colors
```

The script then propagates the new color to all four downstream files in lockstep:

- `android/app/src/main/res/values/colors.xml` (`bootsplash_background`)
- `android/app/src/main/res/values/ic_launcher_background.xml`
- `ios/kiroku/BootSplash.storyboard` (root view `backgroundColor`)
- `scripts/generate-icons.mjs` (`BRAND_BG`)

After running the sync, re-run `npm run generate-icons` to regenerate the icon PNGs that bake the brand color into opaque surfaces.

CI can verify sync status with `npm run sync-brand-colors -- --check` (exits non-zero if any file is stale).

---

### Review Metadata

Flag ONLY when ALL of these are true:

- A PR modifies one of the four downstream files (`android/.../values/colors.xml`, `android/.../values/ic_launcher_background.xml`, `ios/kiroku/BootSplash.storyboard`, `scripts/generate-icons.mjs`) to change the brand color
- The same PR does NOT modify `yellowStrong` in `src/styles/theme/colors.ts`

**DO NOT flag if:**

- The PR is updating an unrelated color in the same file (e.g. `accent` or `dark` in `colors.xml`, the `BootSplashLogo` image reference in the storyboard, an unrelated constant in `generate-icons.mjs`)
- The PR is a result of running `npm run sync-brand-colors` — those edits are expected to land alongside the `yellowStrong` change

**Search Patterns** (hints for reviewers):

- Changes to `bootsplash_background` in `colors.xml`
- Changes to `ic_launcher_background` color value
- Changes to `backgroundColor` `red/green/blue` floats in `BootSplash.storyboard`
- Changes to `const BRAND_BG` in `scripts/generate-icons.mjs`
