#!/usr/bin/env node
/**
 * Generates all app icon and splash-screen assets from a single master SVG.
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 *
 * Input:  assets/images/app-logo.svg  (master source, 1024×1024 recommended)
 * Output: iOS asset catalogs, Android mipmap/drawable directories, web icons
 *
 * Requires: sharp  (npm install --save-dev sharp)
 */

import sharp from 'sharp';
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Variant config ───────────────────────────────────────────────────────────
// badge:  null  = no overlay (production)
//         { label, color } = colored corner triangle badge

const VARIANTS = {
  prod: {badge: null},
  dev: {badge: {label: 'DEV', color: '#007AFF'}},
  staging: {badge: {label: 'STG', color: '#FF9500'}},
  adhoc: {badge: {label: 'ADHOC', color: '#AF52DE'}},
};

// ─── Brand colors ─────────────────────────────────────────────────────────────
// The master SVG (assets/images/app-logo.svg) is intentionally WHITE — it is a
// silhouette that gets composited onto BRAND_BG for opaque surfaces (iOS app
// icons, legacy Android launcher, web favicons), or rendered onto a separately
// configured colored backdrop for transparent surfaces (boot splashes via
// storyboard / colors.xml). In-app rendering tints the master via expo-image
// `tintColor` in src/components/ImageSVG, so the same white master themes
// correctly on light and dark backgrounds.
//
// BRAND_BG must stay in sync with:
//   - android/app/src/main/res/values/colors.xml          (bootsplash_background)
//   - android/app/src/main/res/values/ic_launcher_background.xml
//   - ios/kiroku/BootSplash.storyboard                    (root view backgroundColor)

const BRAND_BG = '#F5C400';

// ─── iOS icon specs ───────────────────────────────────────────────────────────
// Each entry: logical size (pt), scale factor, idiom string

const IOS_ICON_SPECS = [
  // iPhone
  {size: 20, scale: 2, idiom: 'iphone'},
  {size: 20, scale: 3, idiom: 'iphone'},
  {size: 29, scale: 2, idiom: 'iphone'},
  {size: 29, scale: 3, idiom: 'iphone'},
  {size: 40, scale: 2, idiom: 'iphone'},
  {size: 40, scale: 3, idiom: 'iphone'},
  {size: 60, scale: 2, idiom: 'iphone'},
  {size: 60, scale: 3, idiom: 'iphone'},
  // iPad
  {size: 20, scale: 1, idiom: 'ipad'},
  {size: 20, scale: 2, idiom: 'ipad'},
  {size: 29, scale: 1, idiom: 'ipad'},
  {size: 29, scale: 2, idiom: 'ipad'},
  {size: 40, scale: 1, idiom: 'ipad'},
  {size: 40, scale: 2, idiom: 'ipad'},
  {size: 76, scale: 1, idiom: 'ipad'},
  {size: 76, scale: 2, idiom: 'ipad'},
  {size: 83.5, scale: 2, idiom: 'ipad'},
  // App Store marketing
  {size: 1024, scale: 1, idiom: 'ios-marketing'},
];

// ─── Android densities ───────────────────────────────────────────────────────
// iconSize: legacy launcher PNG (dp × dp)
// foreSize: adaptive foreground PNG (108dp equivalent at each density)

const ANDROID_DENSITIES = [
  {folder: 'mipmap-mdpi', iconSize: 48, foreSize: 108},
  {folder: 'mipmap-hdpi', iconSize: 72, foreSize: 162},
  {folder: 'mipmap-xhdpi', iconSize: 96, foreSize: 216},
  {folder: 'mipmap-xxhdpi', iconSize: 144, foreSize: 324},
  {folder: 'mipmap-xxxhdpi', iconSize: 192, foreSize: 432},
];

const ANDROID_NOTIF_DENSITIES = [
  {folder: 'drawable-mdpi', size: 24},
  {folder: 'drawable-hdpi', size: 36},
  {folder: 'drawable-xhdpi', size: 48},
  {folder: 'drawable-xxhdpi', size: 72},
  {folder: 'drawable-xxxhdpi', size: 96},
];

// BootSplash: base 1× size matches current config (108 px)
const BOOTSPLASH_BASE = 108;

// ─── Web icon specs ───────────────────────────────────────────────────────────

const WEB_SPECS = [
  {name: 'favicon.png', size: 32},
  {name: 'apple-touch-icon.png', size: 180},
  {name: 'og-preview-image.png', size: 512},
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(p) {
  mkdirSync(p, {recursive: true});
}

/**
 * Removes every PNG in the given directory before we write new ones.
 * Prevents stale legacy filenames (from older naming conventions) lingering.
 */
function cleanPngs(dir) {
  if (!existsSync(dir)) {
    return;
  }
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.png')) {
      unlinkSync(join(dir, name));
    }
  }
}

/**
 * Returns the filename for an iOS icon given its spec and variant key.
 * The prefix matches the asset catalog name so files and Contents.json stay aligned.
 */
function iosIconFilename(spec, variantKey) {
  const prefix = IOS_VARIANT_ASSET[variantKey];

  if (spec.idiom === 'ios-marketing') {
    return `${prefix}~ios-marketing.png`;
  }

  const sizeStr = String(spec.size);
  const scaleSuffix = spec.scale > 1 ? `@${spec.scale}x` : '';
  const idiomSuffix = spec.idiom === 'ipad' ? '~ipad' : '';

  return `${prefix}-${sizeStr}${scaleSuffix}${idiomSuffix}.png`;
}

/**
 * Builds an SVG string for the corner-triangle badge overlay.
 * The triangle is in the bottom-right corner; text is rendered inside it.
 */
function badgeSvg(canvasSize, label, color) {
  const tri = Math.max(Math.round(canvasSize * 0.38), 14);
  const tx = canvasSize - tri;
  const ty = canvasSize - tri;
  const fontSize = Math.max(Math.round(tri * 0.28), 7);
  const textX = canvasSize - tri * 0.38;
  const textY = canvasSize - tri * 0.18;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}">` +
    `<polygon points="${tx},${canvasSize} ${canvasSize},${canvasSize} ${canvasSize},${ty}" fill="${color}"/>` +
    `<text x="${textX}" y="${textY}" font-size="${fontSize}" fill="white" ` +
    `font-family="Arial,Helvetica,sans-serif" font-weight="bold" text-anchor="middle">${label}</text>` +
    `</svg>`
  );
}

/**
 * Rasterizes the master SVG at pixelSize and optionally composites the badge.
 * Pass `background` to flatten the result onto an opaque color (required for
 * iOS app icons and any surface that must not have alpha).
 */
async function renderIcon(
  svgBuffer,
  pixelSize,
  variant,
  {background = null} = {},
) {
  let pipeline = sharp(svgBuffer).resize(pixelSize, pixelSize);
  if (background) {
    pipeline = pipeline.flatten({background});
  }
  const base = await pipeline.png().toBuffer();

  if (!variant.badge) {
    return base;
  }

  const overlay = Buffer.from(
    badgeSvg(pixelSize, variant.badge.label, variant.badge.color),
  );
  return sharp(base)
    .composite([{input: overlay, blend: 'over'}])
    .png()
    .toBuffer();
}

/**
 * Produces a solid-color PNG of the given size. Used for Android adaptive icon
 * backgrounds, which must be a flat color layer beneath the foreground.
 */
async function solidColorPng(pixelSize, color) {
  return sharp({
    create: {
      width: pixelSize,
      height: pixelSize,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

// ─── iOS app icons ────────────────────────────────────────────────────────────

const IOS_VARIANT_ASSET = {
  prod: 'AppIcon',
  dev: 'AppIconDev',
  staging: 'AppIconStaging',
  adhoc: 'AppIconAdHoc',
};

async function generateIosIcons(svgBuffer) {
  for (const [key, variant] of Object.entries(VARIANTS)) {
    const assetName = IOS_VARIANT_ASSET[key];
    const dir = join(
      ROOT,
      `ios/kiroku/Images.xcassets/${assetName}.appiconset`,
    );
    ensureDir(dir);
    cleanPngs(dir);

    const images = [];
    for (const spec of IOS_ICON_SPECS) {
      const px = Math.round(spec.size * spec.scale);
      const filename = iosIconFilename(spec, key);
      // iOS app icons must be opaque (Apple rejects alpha). Bake in brand bg.
      const buf = await renderIcon(svgBuffer, px, variant, {
        background: BRAND_BG,
      });
      writeFileSync(join(dir, filename), buf);

      images.push({
        filename,
        idiom: spec.idiom,
        scale: `${spec.scale}x`,
        size: `${spec.size}x${spec.size}`,
      });
    }

    writeFileSync(
      join(dir, 'Contents.json'),
      JSON.stringify({images, info: {author: 'xcode', version: 1}}, null, 2) +
        '\n',
    );
    console.log(`  ✓ iOS ${assetName}`);
  }
}

// ─── iOS boot splash ──────────────────────────────────────────────────────────

const IOS_SPLASH_ASSET = {
  prod: 'BootSplashLogo',
  dev: 'BootSplashLogoDev',
  staging: 'BootSplashLogoStaging',
  adhoc: 'BootSplashLogoAdHoc',
};

async function generateIosBootSplash(svgBuffer) {
  const scales = [
    {scale: 1, suffix: ''},
    {scale: 2, suffix: '@2x'},
    {scale: 3, suffix: '@3x'},
  ];

  for (const [key, variant] of Object.entries(VARIANTS)) {
    const assetName = IOS_SPLASH_ASSET[key];
    const dir = join(ROOT, `ios/kiroku/Images.xcassets/${assetName}.imageset`);
    ensureDir(dir);
    cleanPngs(dir);

    const images = [];
    for (const {scale, suffix} of scales) {
      const px = BOOTSPLASH_BASE * scale;
      const filename = `bootsplash_logo${suffix}.png`;
      const buf = await renderIcon(svgBuffer, px, variant);
      writeFileSync(join(dir, filename), buf);
      images.push({filename, idiom: 'universal', scale: `${scale}x`});
    }

    writeFileSync(
      join(dir, 'Contents.json'),
      JSON.stringify({images, info: {author: 'xcode', version: 1}}, null, 2) +
        '\n',
    );
    console.log(`  ✓ iOS ${assetName}`);
  }
}

// ─── Android launcher icons ───────────────────────────────────────────────────

const ANDROID_VARIANT_SRC = {
  prod: 'main',
  dev: 'development',
  staging: 'staging',
  adhoc: 'adhoc',
};

const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;

async function generateAndroidIcons(svgBuffer) {
  for (const [key, variant] of Object.entries(VARIANTS)) {
    const srcSet = ANDROID_VARIANT_SRC[key];
    const resBase = join(ROOT, `android/app/src/${srcSet}/res`);

    for (const d of ANDROID_DENSITIES) {
      const dir = join(resBase, d.folder);
      ensureDir(dir);

      // Legacy launcher PNG (used on Android < 8 and some OEM launchers).
      // Must be opaque — older launchers don't composite over a system bg.
      writeFileSync(
        join(dir, 'ic_launcher.png'),
        await renderIcon(svgBuffer, d.iconSize, variant, {
          background: BRAND_BG,
        }),
      );

      // Adaptive foreground (larger canvas, gets clipped by shape mask).
      // Transparent — sits on top of ic_launcher_background.
      writeFileSync(
        join(dir, 'ic_launcher_foreground.png'),
        await renderIcon(svgBuffer, d.foreSize, variant),
      );

      // Adaptive background — solid brand color, no logo art.
      writeFileSync(
        join(dir, 'ic_launcher_background.png'),
        await solidColorPng(d.iconSize, BRAND_BG),
      );

      // Monochrome (Android 13+ themed icons). System tints this, so the
      // white silhouette becomes whatever color the OS picks.
      writeFileSync(
        join(dir, 'ic_launcher_monochrome.png'),
        await renderIcon(svgBuffer, d.iconSize, variant),
      );
    }

    // Adaptive icon XML descriptor (points to the density-specific PNGs above)
    const anydpiDir = join(resBase, 'mipmap-anydpi-v26');
    ensureDir(anydpiDir);
    writeFileSync(join(anydpiDir, 'ic_launcher.xml'), ADAPTIVE_XML);
    writeFileSync(join(anydpiDir, 'ic_launcher_round.xml'), ADAPTIVE_XML);

    console.log(`  ✓ Android launcher (${srcSet})`);
  }
}

// ─── Android boot splash ──────────────────────────────────────────────────────

async function generateAndroidBootSplash(svgBuffer) {
  for (const [key, variant] of Object.entries(VARIANTS)) {
    const srcSet = ANDROID_VARIANT_SRC[key];

    for (const d of ANDROID_DENSITIES) {
      // drawable-* mirrors mipmap-* naming, using foreground size
      const drawableFolder = d.folder.replace('mipmap-', 'drawable-');
      const dir = join(ROOT, `android/app/src/${srcSet}/res/${drawableFolder}`);
      ensureDir(dir);
      writeFileSync(
        join(dir, 'bootsplash_logo.png'),
        await renderIcon(svgBuffer, d.foreSize, variant),
      );
    }

    console.log(`  ✓ Android splash (${srcSet})`);
  }
}

// ─── Android notification icons ───────────────────────────────────────────────
// Notification icons live in main/ only; they should be white-on-transparent
// silhouettes. We render at small sizes from the production variant (no badge).

async function generateAndroidNotificationIcons(svgBuffer) {
  for (const d of ANDROID_NOTIF_DENSITIES) {
    const dir = join(ROOT, `android/app/src/main/res/${d.folder}`);
    ensureDir(dir);
    writeFileSync(
      join(dir, 'ic_notification.png'),
      await renderIcon(svgBuffer, d.size, VARIANTS.prod),
    );
  }
  console.log('  ✓ Android notification icons');
}

// ─── Env-specific in-app SVG logos ────────────────────────────────────────────
// These are used by KirokuLogo.tsx to render a logo whose corner identifies the
// build environment (matches the badge styling on the app icons). The base art
// is preserved verbatim so it still themes correctly via `fill={theme.appLogo}`;
// the badge is appended with hardcoded fills so it keeps its variant color.

const LOGO_VARIANT_FILE = {
  prod: 'app-logo--prod.svg',
  dev: 'app-logo--dev.svg',
  staging: 'app-logo--staging.svg',
  adhoc: 'app-logo--adhoc.svg',
};

function variantSvg(masterSvg, variant) {
  if (!variant.badge) {
    return masterSvg;
  }
  // Master is 1024x1024 — match the icon badge geometry (~38% of canvas).
  const size = 1024;
  const tri = Math.round(size * 0.38);
  const tx = size - tri;
  const ty = size - tri;
  const fontSize = Math.round(tri * 0.28);
  const textX = size - tri * 0.38;
  const textY = size - tri * 0.18;
  const badge =
    `<polygon points="${tx},${size} ${size},${size} ${size},${ty}" fill="${variant.badge.color}"/>` +
    `<text x="${textX}" y="${textY}" font-size="${fontSize}" fill="white" ` +
    `font-family="Arial,Helvetica,sans-serif" font-weight="bold" text-anchor="middle">${variant.badge.label}</text>`;
  return masterSvg.replace('</svg>', `${badge}</svg>`);
}

function generateEnvLogoSvgs(masterSvgText) {
  for (const [key, variant] of Object.entries(VARIANTS)) {
    const filename = LOGO_VARIANT_FILE[key];
    const dest = join(ROOT, `assets/images/${filename}`);
    writeFileSync(dest, variantSvg(masterSvgText, variant));
    console.log(`  ✓ ${filename}`);
  }
}

// ─── Web icons ────────────────────────────────────────────────────────────────

async function generateWebIcons(svgBuffer) {
  const webDir = join(ROOT, 'web');
  ensureDir(webDir);

  for (const spec of WEB_SPECS) {
    // Web icons render on arbitrary page/OS chrome backgrounds and must be
    // legible standalone — bake in brand bg.
    writeFileSync(
      join(webDir, spec.name),
      await renderIcon(svgBuffer, spec.size, VARIANTS.prod, {
        background: BRAND_BG,
      }),
    );
  }
  console.log('  ✓ Web icons');
}

// ─── web/manifest.json ────────────────────────────────────────────────────────
// Only written if the file does not already exist, to avoid overwriting
// app-specific fields the developer may have customised.

function ensureWebManifest() {
  const dest = join(ROOT, 'web/manifest.json');
  if (existsSync(dest)) {
    return;
  }
  const manifest = {
    short_name: 'Kiroku',
    name: 'Kiroku',
    icons: [
      {
        src: 'favicon.png',
        type: 'image/png',
        sizes: '32x32',
      },
      {
        src: 'apple-touch-icon.png',
        type: 'image/png',
        sizes: '180x180',
      },
      {
        src: 'og-preview-image.png',
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    start_url: '.',
    display: 'standalone',
  };
  writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
  console.log('  ✓ web/manifest.json created');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  const masterSvg = join(ROOT, 'assets/images/app-logo.svg');
  if (!existsSync(masterSvg)) {
    console.error(`ERROR: master SVG not found at ${masterSvg}`);
    process.exit(1);
  }

  console.log(`Generating icons from ${masterSvg}\n`);
  const svgBuffer = readFileSync(masterSvg);
  const masterSvgText = svgBuffer.toString('utf-8');

  console.log('Env-specific in-app SVG logos:');
  generateEnvLogoSvgs(masterSvgText);

  console.log('\niOS app icons:');
  await generateIosIcons(svgBuffer);

  console.log('\niOS boot splash:');
  await generateIosBootSplash(svgBuffer);

  console.log('\nAndroid launcher icons:');
  await generateAndroidIcons(svgBuffer);

  console.log('\nAndroid boot splash:');
  await generateAndroidBootSplash(svgBuffer);

  console.log('\nAndroid notification icons:');
  await generateAndroidNotificationIcons(svgBuffer);

  console.log('\nWeb icons:');
  await generateWebIcons(svgBuffer);
  ensureWebManifest();

  console.log('\nDone. All icons generated successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
