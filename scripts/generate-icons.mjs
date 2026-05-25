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
import TextToSVG from 'text-to-svg';
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

// Font used to bake badge label text ("DEV" / "STG" / "ADHOC") into SVG path
// data. We do this so the same geometry can drive both raster outputs (sharp
// renders the path) and Android Vector Drawable outputs (which have no <text>
// element). Reusing a font already shipped in the app bundle avoids adding a
// new ~300 KB asset just for build-time rendering. The font is OFL-licensed
// (Expensify open-sources their typeface family).
const BADGE_FONT = TextToSVG.loadSync(
  join(ROOT, 'assets/fonts/native/ExpensifyNeue-Bold.otf'),
);

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
// iconSize:   legacy launcher PNG (48dp at density — pre-Android-8 launchers)
// foreSize:   adaptive icon canvas (108dp at density — Android 8+ adaptive icons)
// splashSize: bootsplash logo canvas (288dp at density — react-native-bootsplash
//             default; matches what Android 12+ `windowSplashScreenAnimatedIcon`
//             expects, with the inner art kept inside the 192dp visible area)

const ANDROID_DENSITIES = [
  {folder: 'mipmap-mdpi', iconSize: 48, foreSize: 108, splashSize: 288},
  {folder: 'mipmap-hdpi', iconSize: 72, foreSize: 162, splashSize: 432},
  {folder: 'mipmap-xhdpi', iconSize: 96, foreSize: 216, splashSize: 576},
  {folder: 'mipmap-xxhdpi', iconSize: 144, foreSize: 324, splashSize: 864},
  {folder: 'mipmap-xxxhdpi', iconSize: 192, foreSize: 432, splashSize: 1152},
];

const ANDROID_NOTIF_DENSITIES = [
  {folder: 'drawable-mdpi', size: 24},
  {folder: 'drawable-hdpi', size: 36},
  {folder: 'drawable-xhdpi', size: 48},
  {folder: 'drawable-xxhdpi', size: 72},
  {folder: 'drawable-xxxhdpi', size: 96},
];

// iOS boot splash base size (1× — storyboard sizes the image view at 108pt).
// Android boot splash uses splashSize from ANDROID_DENSITIES instead.
const IOS_BOOTSPLASH_BASE = 108;

// Adaptive icon safe-zone scale. Android's 108dp adaptive canvas reserves the
// inner 66dp (≈61%) as the always-visible safe zone; art outside it can be
// clipped by the launcher's mask. We render the SVG at 60% of the canvas with
// transparent padding so the K logo never touches the mask boundary.
const ADAPTIVE_SAFE_ZONE = 0.6;

// Android boot splash inner-art scale: the splash canvas is 288dp but the
// logo art itself should fit inside a ~108dp inner square — matches the
// pre-refactor visual size and stays well inside Android 12+'s 192dp visible
// area for `windowSplashScreenAnimatedIcon`.
const ANDROID_SPLASH_INNER_SCALE = 108 / 288;

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
 * Builds the geometry for the corner-triangle badge in a given canvas size.
 * Returns the triangle vertices and a glyph path for the label, both in the
 * canvas's own coordinate space. Used by both the SVG composition path (where
 * sharp rasterizes the result) and the Android Vector Drawable emitter (which
 * has no <text> element and needs glyphs as path data).
 */
function badgeGeometry(canvasSize, label, color) {
  const tri = Math.max(Math.round(canvasSize * 0.38), 14);
  const tx = canvasSize - tri;
  const ty = canvasSize - tri;
  const fontSize = Math.max(Math.round(tri * 0.28), 7);
  const textX = canvasSize - tri * 0.38;
  const textY = canvasSize - tri * 0.18;

  const trianglePath = `M${tx},${canvasSize}L${canvasSize},${canvasSize}L${canvasSize},${ty}Z`;
  const labelPath = BADGE_FONT.getD(label, {
    x: textX,
    y: textY,
    fontSize,
    anchor: 'center baseline',
  });

  return {
    triangle: {pathData: trianglePath, fillColor: color},
    label: {pathData: labelPath, fillColor: '#FFFFFF'},
  };
}

/**
 * Builds an SVG string for the corner-triangle badge overlay used during
 * raster compositing. The triangle and the label glyph are both <path>
 * elements (no <text>) so rendering does not depend on whatever system font
 * happens to exist on the build machine.
 */
function badgeSvg(canvasSize, label, color) {
  const {triangle, label: labelPath} = badgeGeometry(canvasSize, label, color);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}">` +
    `<path d="${triangle.pathData}" fill="${triangle.fillColor}"/>` +
    `<path d="${labelPath.pathData}" fill="${labelPath.fillColor}"/>` +
    `</svg>`
  );
}

/**
 * Rasterizes the master SVG into a pixelSize × pixelSize canvas, optionally
 * composites the badge, and optionally flattens onto an opaque background.
 *
 * `innerScale` < 1 renders the art into an inner inset region and pads the
 * surrounding area (transparent, unless `background` is set). The badge — when
 * present — is composited onto the inner buffer so its geometry stays tied to
 * the visible art, not the outer canvas. This is what keeps badges inside the
 * Android adaptive safe zone.
 *
 * Pass `background` to flatten the result onto an opaque color (required for
 * iOS app icons and any surface that must not have alpha).
 */
async function renderIcon(
  svgBuffer,
  pixelSize,
  variant,
  {background = null, innerScale = 1} = {},
) {
  const inner = Math.max(1, Math.round(pixelSize * innerScale));

  let buf = await sharp(svgBuffer).resize(inner, inner).png().toBuffer();

  if (variant.badge) {
    const overlay = Buffer.from(
      badgeSvg(inner, variant.badge.label, variant.badge.color),
    );
    buf = await sharp(buf)
      .composite([{input: overlay, blend: 'over'}])
      .png()
      .toBuffer();
  }

  if (inner < pixelSize) {
    const offset = Math.round((pixelSize - inner) / 2);
    buf = await sharp({
      create: {
        width: pixelSize,
        height: pixelSize,
        channels: 4,
        background: background ?? {r: 0, g: 0, b: 0, alpha: 0},
      },
    })
      .composite([{input: buf, top: offset, left: offset}])
      .png()
      .toBuffer();
  } else if (background) {
    buf = await sharp(buf).flatten({background}).png().toBuffer();
  }

  return buf;
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
      const px = IOS_BOOTSPLASH_BASE * scale;
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

// Resolution at which the single drawable/ic_launcher_monochrome.png is
// rasterized (Android scales it down to whatever density the device needs).
// Matches the xxxhdpi adaptive foreground canvas (432px) so the silhouette
// stays crisp under any launcher mask.
const ANDROID_MONOCHROME_PNG_SIZE = 432;

// Adaptive PNG layer filenames we used to emit per density. The new pipeline
// emits a vector foreground + color background + single-drawable monochrome
// instead, so these per-density PNGs are obsolete. The generator sweeps them
// from each mipmap-*dpi folder on every run so a single re-run after the
// refactor surfaces 60 deletions in `git status`.
const OBSOLETE_ADAPTIVE_PNGS = [
  'ic_launcher_foreground.png',
  'ic_launcher_background.png',
  'ic_launcher_monochrome.png',
];

const ADAPTIVE_XML_WITH_MONOCHROME = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
  <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
`;

const ADAPTIVE_XML_NO_MONOCHROME = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;

/**
 * Parses an attribute list like `d="M0 0..." fill="#FFF"` into a plain map.
 * Accepts both single- and double-quoted values. Whitespace tolerant.
 */
function parseSvgAttrs(attrText) {
  const attrs = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const m of attrText.matchAll(re)) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return attrs;
}

/**
 * Normalizes a CSS color string to an upper-case `#RRGGBB` (or `#AARRGGBB`).
 * Throws if the input is not a literal hex color — Vector Drawable does not
 * accept named CSS colors or rgb()/hsl() in its fillColor attribute.
 */
function normalizeHexColor(c) {
  if (typeof c !== 'string') {
    throw new Error(`svgToVectorDrawable: expected hex color, got ${c}`);
  }
  const v = c.trim();
  if (
    !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v) &&
    !/^#[0-9a-fA-F]{3,4}$/.test(v)
  ) {
    throw new Error(
      `svgToVectorDrawable: unsupported color "${c}". Use #RRGGBB or #AARRGGBB literal hex.`,
    );
  }
  // Expand #RGB / #RGBA shorthand to full 6/8-digit form.
  if (v.length === 4 || v.length === 5) {
    let full = '#';
    for (let i = 1; i < v.length; i += 1) {
      full += v[i] + v[i];
    }
    return full.toUpperCase();
  }
  return v.toUpperCase();
}

/**
 * Validates that an SVG path-data string uses only commands Android Vector
 * Drawable supports. Throws with a precise message on anything else.
 */
function validateSvgPathData(d) {
  if (!d) {
    throw new Error('svgToVectorDrawable: <path> missing d attribute');
  }
  const m = d.match(/[a-zA-Z]/g) || [];
  for (const ch of m) {
    if (!/[MLHVCSQTAZmlhvcsqtaz]/.test(ch)) {
      throw new Error(
        `svgToVectorDrawable: path data contains unsupported command "${ch}". Allowed: M L H V C S Q T A Z (and lower-case variants).`,
      );
    }
  }
}

/**
 * Converts the master SVG to an Android Vector Drawable XML string suitable
 * for `drawable/ic_launcher_foreground.xml`. Wraps the art in an outer
 * <group> that applies the adaptive safe-zone scale + translate, then
 * optionally appends badge paths inside that same group so the badge stays
 * tied to the visible art (matching the raster pipeline's behavior).
 *
 * The converter accepts a deliberately small subset of SVG — <path> and
 * <rect> elements with a literal `fill` color and at most a single
 * `rotate(θ cx cy)` transform on rects. It throws with a precise error on
 * anything else (gradients, masks, nested <g>, percentage units, etc.) so a
 * future master SVG that drifts outside the supported set fails loudly
 * instead of silently producing a broken vector.
 */
function svgToVectorDrawable(
  svgText,
  {innerScale = ADAPTIVE_SAFE_ZONE, badgePaths = []} = {},
) {
  const svgMatch = svgText.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!svgMatch) {
    throw new Error(
      'svgToVectorDrawable: input does not contain a <svg>...</svg> element',
    );
  }
  const rootAttrs = parseSvgAttrs(svgMatch[1]);
  const body = svgMatch[2];

  const vb = rootAttrs.viewBox;
  if (!vb) {
    throw new Error(
      'svgToVectorDrawable: <svg> is missing a viewBox attribute',
    );
  }
  const vbParts = vb
    .trim()
    .split(/[\s,]+/)
    .map(parseFloat);
  if (vbParts.length !== 4 || vbParts.some(n => Number.isNaN(n))) {
    throw new Error(`svgToVectorDrawable: invalid viewBox "${vb}"`);
  }
  const [vbX, vbY, vbW, vbH] = vbParts;
  if (vbX !== 0 || vbY !== 0) {
    throw new Error(
      `svgToVectorDrawable: viewBox must start at (0,0); got "${vb}"`,
    );
  }

  // Reject any tag inside <svg> that we don't explicitly support. Comments are fine.
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b/g;
  const supported = new Set(['path', 'rect']);
  for (const tag of body.matchAll(tagRe)) {
    if (!supported.has(tag[1].toLowerCase())) {
      throw new Error(
        `svgToVectorDrawable: unsupported element <${tag[1]}> in master SVG. ` +
          `The converter accepts only <path> and <rect> inside <svg>. ` +
          `Adjust the SVG or extend the converter.`,
      );
    }
  }

  const artLines = [];
  const elementRe = /<(path|rect)\b([^>]*?)\/?>/gi;
  let elementCount = 0;
  for (const match of body.matchAll(elementRe)) {
    elementCount += 1;
    const elTag = match[1].toLowerCase();
    const elAttrs = parseSvgAttrs(match[2]);
    const fill = elAttrs.fill;
    if (!fill || fill === 'none') {
      continue;
    }
    const fillColor = normalizeHexColor(fill);
    if (elTag === 'path') {
      const d = elAttrs.d;
      validateSvgPathData(d);
      artLines.push(
        `    <path android:pathData="${d}" android:fillColor="${fillColor}"/>`,
      );
    } else {
      const x = parseFloat(elAttrs.x || '0');
      const y = parseFloat(elAttrs.y || '0');
      const w = parseFloat(elAttrs.width);
      const h = parseFloat(elAttrs.height);
      if (Number.isNaN(w) || Number.isNaN(h)) {
        throw new Error(
          'svgToVectorDrawable: <rect> requires numeric width and height',
        );
      }
      const pathData = `M${x},${y}h${w}v${h}h${-w}z`;
      const transform = (elAttrs.transform || '').trim();
      if (transform === '') {
        artLines.push(
          `    <path android:pathData="${pathData}" android:fillColor="${fillColor}"/>`,
        );
      } else {
        const rot = transform.match(
          /^rotate\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/,
        );
        if (!rot) {
          throw new Error(
            `svgToVectorDrawable: <rect> has unsupported transform="${transform}". ` +
              `Only "rotate(angle cx cy)" with three numeric args is supported.`,
          );
        }
        artLines.push(
          `    <group android:pivotX="${rot[2]}" android:pivotY="${rot[3]}" android:rotation="${rot[1]}">`,
          `      <path android:pathData="${pathData}" android:fillColor="${fillColor}"/>`,
          `    </group>`,
        );
      }
    }
  }
  if (elementCount === 0) {
    throw new Error(
      'svgToVectorDrawable: no <path> or <rect> elements found in <svg>',
    );
  }

  for (const bp of badgePaths) {
    artLines.push(
      `    <path android:pathData="${bp.pathData}" android:fillColor="${normalizeHexColor(bp.fillColor)}"/>`,
    );
  }

  const tx = (vbW * (1 - innerScale)) / 2;
  const ty = (vbH * (1 - innerScale)) / 2;

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
    '    android:width="108dp"',
    '    android:height="108dp"',
    `    android:viewportWidth="${vbW}"`,
    `    android:viewportHeight="${vbH}">`,
    `  <group android:scaleX="${innerScale}" android:scaleY="${innerScale}" android:translateX="${tx}" android:translateY="${ty}">`,
    ...artLines,
    '  </group>',
    '</vector>',
    '',
  ].join('\n');
}

/**
 * Computes badge geometry for the master SVG's viewport. Used by the Vector
 * Drawable emitter so badges have the same proportions as in raster outputs.
 * Returns the triangle + label as Vector Drawable-compatible path records.
 */
function badgePathsForVectorViewport(viewportSize, variant) {
  if (!variant.badge) {
    return [];
  }
  const {triangle, label} = badgeGeometry(
    viewportSize,
    variant.badge.label,
    variant.badge.color,
  );
  return [triangle, label];
}

/**
 * Removes adaptive-layer PNGs that the new pipeline no longer emits. Without
 * this, the first re-run after the vector refactor would leave the stale
 * files in place; with it, they show up as deletions in `git status`.
 */
function sweepObsoleteAdaptiveLauncherPngs(dir) {
  if (!existsSync(dir)) {
    return;
  }
  for (const name of OBSOLETE_ADAPTIVE_PNGS) {
    const p = join(dir, name);
    if (existsSync(p)) {
      unlinkSync(p);
    }
  }
}

/**
 * Removes the legacy round-launcher XML descriptor. Kiroku's manifest does
 * not set `android:roundIcon`, so this file has always been unreferenced and
 * adds dead bytes to every flavor's APK.
 */
function sweepLegacyRoundLauncherXml(anydpiDir) {
  const p = join(anydpiDir, 'ic_launcher_round.xml');
  if (existsSync(p)) {
    unlinkSync(p);
  }
}

async function generateAndroidIcons(svgBuffer, masterSvgText) {
  for (const [key, variant] of Object.entries(VARIANTS)) {
    const srcSet = ANDROID_VARIANT_SRC[key];
    const resBase = join(ROOT, `android/app/src/${srcSet}/res`);

    // Legacy launcher PNG (used on Android < 8 and some OEM launchers). Per
    // density; opaque (older launchers don't composite over a system bg).
    for (const d of ANDROID_DENSITIES) {
      const dir = join(resBase, d.folder);
      ensureDir(dir);
      writeFileSync(
        join(dir, 'ic_launcher.png'),
        await renderIcon(svgBuffer, d.iconSize, variant, {
          background: BRAND_BG,
        }),
      );
      // Drop the per-density adaptive-layer PNGs we used to write here.
      sweepObsoleteAdaptiveLauncherPngs(dir);
    }

    // Adaptive foreground: one vector XML. Crisp at every density, no
    // rasterization. The art lives inside the 66dp safe zone so launcher
    // masks never clip it; the badge (when present) sits in the same group.
    const drawableDir = join(resBase, 'drawable');
    ensureDir(drawableDir);
    writeFileSync(
      join(drawableDir, 'ic_launcher_foreground.xml'),
      svgToVectorDrawable(masterSvgText, {
        innerScale: ADAPTIVE_SAFE_ZONE,
        badgePaths: badgePathsForVectorViewport(1024, variant),
      }),
    );

    // Adaptive XML descriptor. Prod includes <monochrome> for Android 13+
    // themed-icons mode; the flavor variants omit it so Themed Icons doesn't
    // erase their badge by rendering an identical silhouette across all
    // four builds.
    const anydpiDir = join(resBase, 'mipmap-anydpi-v26');
    ensureDir(anydpiDir);
    writeFileSync(
      join(anydpiDir, 'ic_launcher.xml'),
      key === 'prod'
        ? ADAPTIVE_XML_WITH_MONOCHROME
        : ADAPTIVE_XML_NO_MONOCHROME,
    );
    sweepLegacyRoundLauncherXml(anydpiDir);

    console.log(`  ✓ Android launcher (${srcSet})`);
  }

  // Monochrome layer for Android 13+ themed icons. Production only — see
  // above. One PNG in drawable/ (Android scales it per density); rasterized
  // at xxxhdpi resolution so downscale artifacts stay invisible on a
  // silhouette.
  const mainDrawable = join(ROOT, 'android/app/src/main/res/drawable');
  ensureDir(mainDrawable);
  writeFileSync(
    join(mainDrawable, 'ic_launcher_monochrome.png'),
    await renderIcon(svgBuffer, ANDROID_MONOCHROME_PNG_SIZE, VARIANTS.prod, {
      innerScale: ADAPTIVE_SAFE_ZONE,
    }),
  );
  console.log('  ✓ Android monochrome (main only)');
}

// ─── Android boot splash ──────────────────────────────────────────────────────

async function generateAndroidBootSplash(svgBuffer) {
  for (const [key, variant] of Object.entries(VARIANTS)) {
    const srcSet = ANDROID_VARIANT_SRC[key];

    for (const d of ANDROID_DENSITIES) {
      // drawable-* mirrors mipmap-* naming. Canvas is 288dp at each density —
      // matches react-native-bootsplash's default and Android 12+'s
      // windowSplashScreenAnimatedIcon spec. Art is rendered at the inner
      // 108dp inset so it visually matches the launcher icon size and stays
      // well inside the 192dp visible area.
      const drawableFolder = d.folder.replace('mipmap-', 'drawable-');
      const dir = join(ROOT, `android/app/src/${srcSet}/res/${drawableFolder}`);
      ensureDir(dir);
      writeFileSync(
        join(dir, 'bootsplash_logo.png'),
        await renderIcon(svgBuffer, d.splashSize, variant, {
          innerScale: ANDROID_SPLASH_INNER_SCALE,
        }),
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
  // Master is 1024x1024. Reuse the same geometry as the rasterized icons so
  // the in-app SVG looks identical to the launcher icon for each variant.
  const {triangle, label} = badgeGeometry(
    1024,
    variant.badge.label,
    variant.badge.color,
  );
  const badge =
    `<path d="${triangle.pathData}" fill="${triangle.fillColor}"/>` +
    `<path d="${label.pathData}" fill="${label.fillColor}"/>`;
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
  await generateAndroidIcons(svgBuffer, masterSvgText);

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
