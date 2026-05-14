#!/usr/bin/env node
/**
 * Propagates the brand color from src/styles/theme/colors.ts (`yellowStrong`)
 * to every place outside the TS theme tree where the same color must be
 * hard-coded:
 *
 *   - android/app/src/main/res/values/colors.xml         (bootsplash_background)
 *   - android/app/src/main/res/values/ic_launcher_background.xml
 *   - ios/kiroku/BootSplash.storyboard                   (root view backgroundColor)
 *   - scripts/generate-icons.mjs                         (BRAND_BG constant)
 *
 * Usage:
 *   node scripts/sync-brand-colors.mjs           # write
 *   node scripts/sync-brand-colors.mjs --check   # exit 1 if any file is stale
 *
 * Source of truth: `yellowStrong` in src/styles/theme/colors.ts. Edit that
 * one line and run this script; everything else updates in lockstep.
 */

import {readFileSync, writeFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE = 'src/styles/theme/colors.ts';
const TOKEN = 'yellowStrong';

const TARGETS = [
  'android/app/src/main/res/values/colors.xml',
  'android/app/src/main/res/values/ic_launcher_background.xml',
  'ios/kiroku/BootSplash.storyboard',
  'scripts/generate-icons.mjs',
];

const checkMode = process.argv.includes('--check');

function readBrandColor() {
  const content = readFileSync(join(ROOT, SOURCE), 'utf8');
  // Match `yellowStrong: '#XXXXXX'` (or "#XXXXXX"), skipping commented-out lines.
  const re = new RegExp(
    `^\\s*${TOKEN}\\s*:\\s*['"](#[0-9a-fA-F]{6,8})['"]`,
    'm',
  );
  const match = content.match(re);
  if (!match) {
    throw new Error(
      `Couldn't find active ${TOKEN}: '#…' assignment in ${SOURCE}`,
    );
  }
  return match[1].toUpperCase();
}

function hexToRgbFloats(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b].map(formatFloat);
}

function formatFloat(n) {
  if (n === 0) {
    return '0';
  }
  if (n === 1) {
    return '1';
  }
  // Match Xcode's storyboard precision: ~8 decimals, trailing zeros trimmed.
  return n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

function updateAndroidColorsXml(content, hex) {
  return content.replace(
    /(<color\s+name="bootsplash_background">)#[0-9A-Fa-f]{6,8}(<\/color>)/,
    `$1${hex}$2`,
  );
}

function updateAndroidIcLauncherBgXml(content, hex) {
  return content.replace(
    /(<color\s+name="ic_launcher_background">)#[0-9A-Fa-f]{6,8}(<\/color>)/,
    `$1${hex}$2`,
  );
}

function updateIosStoryboard(content, hex) {
  // Compare by value, not by exact float-string representation — Xcode emits
  // different precision per channel, so a string-equal check would falsely
  // flag the file as stale every time. Parse existing floats → hex; only
  // rewrite if the *color* differs.
  const re =
    /(<color\s+key="backgroundColor"\s+)red="([^"]+)"(\s+)green="([^"]+)"(\s+)blue="([^"]+)"/;
  const match = content.match(re);
  if (!match) {
    return content;
  }
  const currentHex = floatsToHex(
    parseFloat(match[2]),
    parseFloat(match[4]),
    parseFloat(match[6]),
  );
  if (currentHex === hex.toUpperCase()) {
    return content;
  }
  const [r, g, b] = hexToRgbFloats(hex);
  return content.replace(re, `$1red="${r}"$3green="${g}"$5blue="${b}"`);
}

function floatsToHex(r, g, b) {
  const to = n =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${to(r)}${to(g)}${to(b)}`;
}

function updateGenerateIconsScript(content, hex) {
  return content.replace(
    /(const\s+BRAND_BG\s*=\s*)['"]#[0-9A-Fa-f]{6,8}['"]/,
    `$1'${hex}'`,
  );
}

const UPDATERS = {
  'android/app/src/main/res/values/colors.xml': updateAndroidColorsXml,
  'android/app/src/main/res/values/ic_launcher_background.xml':
    updateAndroidIcLauncherBgXml,
  'ios/kiroku/BootSplash.storyboard': updateIosStoryboard,
  'scripts/generate-icons.mjs': updateGenerateIconsScript,
};

const brand = readBrandColor();
console.log(`Brand color: ${brand} (from ${SOURCE} :: ${TOKEN})\n`);

let staleCount = 0;
for (const relPath of TARGETS) {
  const abs = join(ROOT, relPath);
  const before = readFileSync(abs, 'utf8');
  const after = UPDATERS[relPath](before, brand);

  if (before === after) {
    // Either in sync, or the pattern didn't match at all. Differentiate by
    // re-running the updater against a deliberately-different hex; if the
    // file still doesn't change, the pattern is broken.
    const probe = brand === '#000000' ? '#FFFFFF' : '#000000';
    if (UPDATERS[relPath](before, probe) === before) {
      throw new Error(
        `${relPath}: target pattern didn't match. Has the file shape changed?`,
      );
    }
    console.log(`  ✓ ${relPath} (in sync)`);
    continue;
  }

  staleCount++;
  if (checkMode) {
    console.log(`  ✗ ${relPath} (stale)`);
  } else {
    writeFileSync(abs, after);
    console.log(`  ↻ ${relPath} (updated)`);
  }
}

console.log();
if (checkMode && staleCount > 0) {
  console.error(
    `${staleCount} file(s) out of sync. Run without --check to fix.`,
  );
  process.exit(1);
}
if (staleCount === 0) {
  console.log('All brand-color references in sync.');
} else {
  console.log(`Updated ${staleCount} file(s).`);
}
