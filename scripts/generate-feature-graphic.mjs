/**
 * Generate the Google Play "feature graphic" (the 1024×500 banner shown at the
 * top of the Play Store listing) from the brand master art.
 *
 * Mirrors the established banner layout: a diagonal gold gradient field, the
 * app icon shown as a rounded "squircle" tile with a soft drop shadow on the
 * left, and the white "Kiroku" wordmark + two-line tagline on the right. The
 * only thing that changes vs. the legacy banner is the icon itself — the new
 * pencil-beer app icon replaces the old martini-glass tile.
 *
 * Single source of truth: the rendered production app icon
 * (`AppIcon~ios-marketing.png`, emitted by generate-icons.mjs from the mascot
 * master). Text is baked to glyph paths via `text-to-svg` so the render does
 * not depend on the Expensify typeface being installed system-wide (same trick
 * generate-icons.mjs uses for the variant badges).
 *
 * Run:  node scripts/generate-feature-graphic.mjs
 *
 * Output: fastlane/metadata/android/en-US/images/featureGraphic.png
 *         (the path `fastlane supply` reads for the Play Store feature graphic)
 *
 * Requires: sharp, text-to-svg (already dev-deps, used by generate-icons.mjs).
 */

import sharp from 'sharp';
import TextToSVG from 'text-to-svg';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {mkdirSync} from 'fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─── Output spec (Google Play feature graphic — EXACT required size) ──────────
const WIDTH = 1024;
const HEIGHT = 500;
const OUT = join(
  ROOT,
  'fastlane/metadata/android/en-US/images/featureGraphic.png',
);

// ─── Source art ───────────────────────────────────────────────────────────────
// The shipped app icon (pencil-beer mascot on the white field). Rounded into a
// squircle tile to mirror how the icon reads on the store.
const APP_ICON = join(
  ROOT,
  'ios/kiroku/Images.xcassets/AppIcon.appiconset/AppIcon~ios-marketing.png',
);

// ─── Copy ─────────────────────────────────────────────────────────────────────
const WORDMARK = 'Kiroku';
const TAGLINE = ['Keep track of your', 'alcohol adventures.'];
const TEXT_COLOR = '#FFFFFF';

const FONT_BOLD = TextToSVG.loadSync(
  join(ROOT, 'assets/fonts/native/ExpensifyNeue-Bold.otf'),
);
const FONT_REG = TextToSVG.loadSync(
  join(ROOT, 'assets/fonts/native/ExpensifyNeue-Regular.otf'),
);

// ─── Brand gradient (diagonal: lighter gold TL → deeper amber BR) ─────────────
// Sampled from the reference banner.
const GRADIENT = [
  {offset: 0, color: '#FAD93A'},
  {offset: 0.5, color: '#F5C605'},
  {offset: 1, color: '#E8B400'},
];

// ─── Layout (px on the 1024×500 canvas; sampled from the reference banner) ────
const TILE = {x: 76, y: 85, size: 330, radius: 74}; // squircle ≈ 0.2237·size
const TEXT_LEFT = 478;
const WORDMARK_LAYOUT = {targetWidth: 366, baseline: 248};
const TAGLINE_LAYOUT = {targetWidth: 344, baselines: [320, 368]};

// width scales linearly with font size, so one measurement gives the fit.
const fitFontSize = (font, text, targetWidth, probe = 100) =>
  (probe * targetWidth) / font.getMetrics(text, {fontSize: probe}).width;

async function main() {
  // ── Icon tile: resize the app icon and clip it to a rounded squircle. ──
  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE.size}" height="${TILE.size}"><rect width="${TILE.size}" height="${TILE.size}" rx="${TILE.radius}" ry="${TILE.radius}" fill="#fff"/></svg>`,
  );
  const iconTile = await sharp(APP_ICON)
    .resize(TILE.size, TILE.size, {fit: 'cover'})
    .composite([{input: maskSvg, blend: 'dest-in'}])
    .png()
    .toBuffer();

  // ── Background gradient + the tile's soft drop shadow. ──
  const stops = GRADIENT.map(
    s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`,
  ).join('');
  const baseSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient><filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#5e4a00" flood-opacity="0.22"/></filter></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/><rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.radius}" ry="${TILE.radius}" fill="#ffffff" filter="url(#shadow)"/></svg>`,
  );

  // ── Text → glyph paths (font-independent), white, left-aligned. ──
  const wordmarkSize = fitFontSize(
    FONT_BOLD,
    WORDMARK,
    WORDMARK_LAYOUT.targetWidth,
  );
  const taglineSize = fitFontSize(
    FONT_REG,
    TAGLINE[0],
    TAGLINE_LAYOUT.targetWidth,
  );
  const paths = [
    FONT_BOLD.getD(WORDMARK, {
      x: TEXT_LEFT,
      y: WORDMARK_LAYOUT.baseline,
      fontSize: wordmarkSize,
      anchor: 'left baseline',
    }),
    ...TAGLINE.map((line, i) =>
      FONT_REG.getD(line, {
        x: TEXT_LEFT,
        y: TAGLINE_LAYOUT.baselines[i],
        fontSize: taglineSize,
        anchor: 'left baseline',
      }),
    ),
  ];
  const pathTags = paths
    .map(d => `<path d="${d}" fill="${TEXT_COLOR}"/>`)
    .join('');
  const textSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${pathTags}</svg>`,
  );

  mkdirSync(dirname(OUT), {recursive: true});
  await sharp(baseSvg)
    .composite([
      {input: iconTile, left: TILE.x, top: TILE.y},
      {input: textSvg, left: 0, top: 0},
    ])
    .png()
    .toFile(OUT);

  console.log(`Wrote ${OUT} (${WIDTH}×${HEIGHT})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
