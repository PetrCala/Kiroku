#!/usr/bin/env node
/**
 * Frame raw app captures into App Store-ready marketing screenshots.
 *
 * Composites your REAL app screenshots onto a branded background with a caption,
 * at the EXACT pixel sizes App Store Connect requires. Deterministic (sharp +
 * text-to-svg, the same stack as generate-icons.mjs) — no headless browser, no
 * generative image model, so output is pixel-perfect and re-runnable.
 *
 * Usage:
 *   node scripts/frame-app-store-screenshots.mjs            # render everything
 *   node scripts/frame-app-store-screenshots.mjs --locale cs --device 6.9
 *   node scripts/frame-app-store-screenshots.mjs --check    # report inputs only
 *
 * Input:  fastlane/store-screenshots/raw/<locale>/<shot.raw>   (you provide)
 * Output: fastlane/store-screenshots/framed/<locale>/<device>/NN_<name>.png
 *
 * Config: scripts/store-screenshots.config.mjs
 * Requires: sharp, text-to-svg (already in devDependencies).
 *
 * Apple Guideline 2.3.3: the capture content must match the shipped app. This
 * tool only adds marketing chrome (background + caption) — it never fabricates
 * app UI.
 */

import sharp from 'sharp';
import TextToSVG from 'text-to-svg';
import {readFileSync, mkdirSync, existsSync, rmSync} from 'fs';
import {join, dirname, parse} from 'path';
import {fileURLToPath} from 'url';
import config from './store-screenshots.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const {RAW_DIR, OUT_DIR, devices, locales, theme, shots} = config;

// ─── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] ?? true : undefined;
};
const onlyLocale = flag('locale');
const onlyDevice = flag('device');
const checkOnly = args.includes('--check');

const font = TextToSVG.loadSync(join(ROOT, theme.captionFont));

// ─── Helpers ────────────────────────────────────────────────────────────────
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'})[
        c
      ],
  );

/** Greedy word-wrap using real font metrics, capped at `maxLines`. */
function wrap(text, fontSize, maxWidth, maxLines = 3) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const width = t => font.getMetrics(t, {fontSize}).width;
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (width(candidate) > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) {
        break;
      }
    } else {
      line = candidate;
    }
  }
  // Remaining words (incl. anything left when we hit maxLines) go on the last line.
  const used = lines.join(' ');
  const rest = text.slice(used.length).trim();
  if (rest) {
    lines.push(rest);
  }
  return lines.slice(0, maxLines);
}

function gradientSvg(w, h, stops) {
  if (stops.length === 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${stops[0]}"/></svg>`;
  }
  const offsets = stops
    .map(
      (c, i) =>
        `<stop offset="${(i / (stops.length - 1)) * 100}%" stop-color="${c}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${offsets}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
}

/** Full-canvas SVG with the centered, wrapped caption baked as vector paths. */
function captionSvg(lines, w, h, fontSize) {
  const lineHeight = Math.round(fontSize * 1.22);
  const top = Math.round(h * theme.captionTopRatio);
  const paths = lines
    .map((ln, i) => {
      const d = font.getD(ln, {
        x: w / 2,
        y: top + i * lineHeight,
        fontSize,
        anchor: 'center top',
      });
      return `<path d="${d}" fill="${theme.captionColor}"/>`;
    })
    .join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${paths}</svg>`,
    blockHeight: top + lines.length * lineHeight,
  };
}

function roundedMask(w, h, r) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`,
  );
}

// ─── Render one (shot, locale, device) ──────────────────────────────────────
async function render(shot, index, locale, device) {
  const {width: W, height: H} = device;
  const rawPath = join(ROOT, RAW_DIR, locale, shot.raw);
  if (!existsSync(rawPath)) {
    return {status: 'missing', rawPath};
  }

  const fontSize = Math.round(W * theme.captionSizeRatio);
  const maxTextWidth = Math.round(W * theme.captionMaxWidthRatio);
  const caption = shot.caption?.[locale] ?? shot.caption?.['en-US'] ?? '';
  const lines = caption ? wrap(esc(caption), fontSize, maxTextWidth) : [];
  const {svg: capSvg, blockHeight} = captionSvg(lines, W, H, fontSize);

  // Layout: caption block on top, screenshot fills the remaining area.
  const top = blockHeight + Math.round(H * theme.gapRatio);
  const maxW = Math.round(W * theme.screenshotMaxWidthRatio);
  const maxH = H - top - Math.round(H * theme.bottomRatio);

  const rawBuf = readFileSync(rawPath);
  const meta = await sharp(rawBuf).metadata();
  const scale = Math.min(maxW / meta.width, maxH / meta.height);
  const sw = Math.max(1, Math.round(meta.width * scale));
  const sh = Math.max(1, Math.round(meta.height * scale));
  const radius = Math.round(sw * theme.cornerRadiusRatio);

  const shotBuf = await sharp(rawBuf)
    .resize(sw, sh, {fit: 'fill'})
    .composite([{input: roundedMask(sw, sh, radius), blend: 'dest-in'}])
    .png()
    .toBuffer();

  const left = Math.round((W - sw) / 2);
  const out = await sharp(Buffer.from(gradientSvg(W, H, theme.background)))
    .composite([
      {input: shotBuf, top, left},
      {input: Buffer.from(capSvg), top: 0, left: 0},
    ])
    .png()
    .toBuffer();

  // Verify exact dimensions before writing.
  const outMeta = await sharp(out).metadata();
  if (outMeta.width !== W || outMeta.height !== H) {
    throw new Error(
      `Output size ${outMeta.width}x${outMeta.height} != required ${W}x${H} for ${shot.raw}`,
    );
  }

  const outDir = join(ROOT, OUT_DIR, locale, device.id);
  mkdirSync(outDir, {recursive: true});
  const name = parse(shot.raw).name;
  const outPath = join(
    outDir,
    `${String(index + 1).padStart(2, '0')}_${name}.png`,
  );
  await sharp(out).toFile(outPath);
  return {status: 'ok', outPath};
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const targetLocales = locales.filter(l => !onlyLocale || l === onlyLocale);
  const targetDevices = devices.filter(d => !onlyDevice || d.id === onlyDevice);

  if (checkOnly) {
    console.log('Raw-capture status:');
    let missing = 0;
    for (const locale of targetLocales) {
      for (const [i, shot] of shots.entries()) {
        const p = join(ROOT, RAW_DIR, locale, shot.raw);
        const ok = existsSync(p);
        if (!ok) {
          missing++;
        }
        console.log(
          `  ${ok ? '✓' : '✗'} ${locale}/${shot.raw}` +
            (ok ? '' : '  (missing)'),
        );
      }
    }
    console.log(
      missing
        ? `\n${missing} capture(s) missing — drop them in ${RAW_DIR}/<locale>/`
        : '\nAll captures present.',
    );
    return;
  }

  // Start each run from a clean output tree so deleted shots don't linger.
  for (const locale of targetLocales) {
    for (const device of targetDevices) {
      const dir = join(ROOT, OUT_DIR, locale, device.id);
      if (existsSync(dir)) {
        rmSync(dir, {recursive: true, force: true});
      }
    }
  }

  let ok = 0;
  let missing = 0;
  for (const locale of targetLocales) {
    for (const device of targetDevices) {
      for (const [i, shot] of shots.entries()) {
        const res = await render(shot, i, locale, device);
        if (res.status === 'ok') {
          ok++;
          console.log(
            `✓ ${locale}/${device.id}  ${res.outPath.split('/').slice(-1)[0]}`,
          );
        } else {
          missing++;
          console.warn(`✗ missing capture: ${RAW_DIR}/${locale}/${shot.raw}`);
        }
      }
    }
  }
  console.log(`\nDone. ${ok} framed, ${missing} skipped (missing captures).`);
  if (missing) {
    console.log(
      `Drop the missing raw captures in ${RAW_DIR}/<locale>/ and re-run.`,
    );
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
