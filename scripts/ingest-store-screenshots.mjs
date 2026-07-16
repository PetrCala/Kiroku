#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI build script; stdout is its UI */
/**
 * Ingest fastlane capture output into the framing pipeline's raw/ tree.
 *
 * Bridges the two halves of the store-screenshot pipeline. fastlane `snapshot`
 * (iOS) and `screengrab` (Android) write captures named after the UI tests'
 * snapshot() calls; frame-app-store-screenshots.mjs expects differently-named,
 * locale-remapped, per-platform inputs. This mapper copies + renames the
 * captures into place, driven by the SAME manifest the framer uses
 * (store-screenshots.config.mjs), so the halves can never silently drift.
 *
 * Capture layout (input), per platform:
 *   iOS  (snapshot):      <captureDir>/<captureLocale>/<sourceDevice>/<snapshot>.png
 *   Android (screengrab): <captureDir>/<captureLocale>/images/<snapshot>.png
 * Raw layout (output, consumed by the framer):
 *   fastlane/store-screenshots/raw/<platform>/<locale>/<raw>
 *
 * Mapping comes from config.shots[].{snapshot,raw}, config.captureLocales
 * (en-US→en-US, cs→cs-CZ) and config.platforms[platform]. Captures with no
 * manifest entry (e.g. 05_Settings) are reported and skipped. Bytes are copied
 * verbatim (store guidelines — never alter the real capture).
 *
 * Usage:
 *   node scripts/ingest-store-screenshots.mjs                     # iOS, from fastlane/screenshots/ios
 *   node scripts/ingest-store-screenshots.mjs --platform android  # Android, from fastlane/screenshots/android
 *   node scripts/ingest-store-screenshots.mjs --from ~/Downloads/ios-screenshots-<sha>
 *   node scripts/ingest-store-screenshots.mjs --locale cs         # one locale
 *   node scripts/ingest-store-screenshots.mjs --device "iPad Pro 13-inch (M5)"  # override source device folder (iOS)
 *   node scripts/ingest-store-screenshots.mjs --check             # dry-run report, copy nothing
 *
 * Config: scripts/store-screenshots.config.mjs   (shared with the framer)
 */

import {copyFileSync, existsSync, mkdirSync, readdirSync} from 'fs';
import {dirname, isAbsolute, join} from 'path';
import {fileURLToPath} from 'url';
// eslint-disable-next-line import/extensions -- Node ESM requires the explicit extension
import config from './store-screenshots.config.mjs';

const {RAW_DIR, locales, shots, captureLocales, platforms} = config;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(scriptDir, '..');

// ─── CLI args (same convention as frame-app-store-screenshots.mjs) ────────────
const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] ?? true : undefined;
};
const platform =
  typeof flag('platform') === 'string' ? flag('platform') : 'ios';
if (!platforms[platform]) {
  console.error(
    `Unknown --platform "${platform}". Known: ${Object.keys(platforms).join(', ')}`,
  );
  process.exit(1);
}
const {captureDir, sourceDevice, captureLayout} = platforms[platform];

const fromArg = flag('from');
const onlyLocale = flag('locale');
const deviceOverride =
  typeof flag('device') === 'string' ? flag('device') : undefined;
const checkOnly = args.includes('--check');

const DEFAULT_FROM = join(ROOT, ...captureDir.split('/'));
function resolveFromDir(value) {
  if (typeof value !== 'string') {
    return DEFAULT_FROM;
  }
  return isAbsolute(value) ? value : join(ROOT, value);
}
const fromDir = resolveFromDir(fromArg);

const rel = p => (p.startsWith(`${ROOT}/`) ? p.slice(ROOT.length + 1) : p);
const isPng = f => f.toLowerCase().endsWith('.png');

// ─── Source resolution ────────────────────────────────────────────────────────
/** Accept either the capture dir itself (<captureLocale>/ as direct children)
 *  or a downloaded-artifact dir that still nests <captureDir>/. */
function resolveSourceRoot(base) {
  const candidates = [base, join(base, ...captureDir.split('/'))];
  for (const candidate of candidates) {
    const hasLocale = Object.values(captureLocales).some(cl =>
      existsSync(join(candidate, cl)),
    );
    if (existsSync(candidate) && hasLocale) {
      return candidate;
    }
  }
  return base; // fall through; per-locale warnings report what's missing
}

/** The directory that holds a locale's capture PNGs. iOS nests a device
 *  folder; Android (screengrab) nests an `images/` folder. */
function resolveCaptureDir(localeSrcDir, locale) {
  if (captureLayout === 'images') {
    const imagesDir = join(localeSrcDir, 'images');
    return existsSync(imagesDir) ? imagesDir : localeSrcDir;
  }
  // captureLayout === 'device'
  if (deviceOverride) {
    return join(localeSrcDir, deviceOverride);
  }
  if (sourceDevice && existsSync(join(localeSrcDir, sourceDevice))) {
    return join(localeSrcDir, sourceDevice);
  }
  const subdirs = existsSync(localeSrcDir)
    ? readdirSync(localeSrcDir, {withFileTypes: true})
        .filter(d => d.isDirectory())
        .map(d => d.name)
    : [];
  const iphones = subdirs.filter(n => /iphone/i.test(n));
  if (iphones.length === 1) {
    console.warn(
      `  ! ${locale}: "${sourceDevice}" not found, using "${iphones[0]}"`,
    );
    return join(localeSrcDir, iphones[0]);
  }
  if (iphones.length > 1) {
    console.warn(
      `  ! ${locale}: "${sourceDevice}" not found; multiple iPhone folders ${JSON.stringify(
        iphones,
      )}. Pass --device "<name>". Skipping.`,
    );
    return null;
  }
  console.warn(
    `  ✗ ${locale}: no device capture folder under ${rel(
      localeSrcDir,
    )} (found ${JSON.stringify(subdirs)})`,
  );
  return null;
}

/** Find the capture PNG for a snapshot in `dir`. Tolerant of capture-tool
 *  naming: exact `<snapshot>.png`, else a file ending `…<snapshot>.png`
 *  (screengrab may prefix the test-class name). */
function findCapture(dir, snapshot) {
  const exact = join(dir, `${snapshot}.png`);
  if (existsSync(exact)) {
    return exact;
  }
  if (!existsSync(dir)) {
    return null;
  }
  const match = readdirSync(dir).find(
    f => isPng(f) && f.endsWith(`${snapshot}.png`),
  );
  return match ? join(dir, match) : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const sourceRoot = resolveSourceRoot(fromDir);
  if (!existsSync(sourceRoot)) {
    console.error(
      `No ${platform} capture source at ${rel(
        sourceRoot,
      )}. Capture first (see the store-screenshots skill) or pass --from <dir>.`,
    );
    process.exit(1);
  }
  console.log(
    `${checkOnly ? '[check] ' : ''}Ingesting ${platform} captures from ${rel(
      sourceRoot,
    )}\n`,
  );

  const mappedNames = shots.filter(s => s.snapshot).map(s => s.snapshot);
  const targetLocales = locales.filter(l => !onlyLocale || l === onlyLocale);
  const frameHint =
    platform === 'ios'
      ? 'npm run frame-screenshots'
      : 'npm run frame-screenshots -- --platform android';
  let copied = 0;
  let missing = 0;

  for (const locale of targetLocales) {
    const captureLocale = captureLocales[locale] ?? locale;
    if (!captureLocales[locale]) {
      console.warn(
        `  ! ${locale}: no captureLocales mapping; trying "${locale}" verbatim`,
      );
    }
    const localeSrcDir = join(sourceRoot, captureLocale);
    const capturePngDir = resolveCaptureDir(localeSrcDir, locale);
    if (!capturePngDir || !existsSync(capturePngDir)) {
      missing += shots.length;
      continue;
    }

    // Surface captures present in the source that the manifest doesn't map
    // (e.g. 05_Settings) so a skipped screen is visible, not silent.
    for (const f of readdirSync(capturePngDir)) {
      if (isPng(f) && !mappedNames.some(name => f.endsWith(`${name}.png`))) {
        console.log(`  – ${captureLocale}/${f} (not in manifest, skipped)`);
      }
    }

    for (const shot of shots) {
      if (!shot.snapshot) {
        console.warn(
          `  ! ${locale}: shot ${shot.raw} has no "snapshot" mapping, skipped`,
        );
        missing += 1;
        continue;
      }
      const src = findCapture(capturePngDir, shot.snapshot);
      const dest = join(ROOT, RAW_DIR, platform, locale, shot.raw);
      if (!src) {
        console.warn(
          `  ✗ ${locale}: missing ${shot.snapshot}.png in ${rel(capturePngDir)}`,
        );
        missing += 1;
        continue;
      }
      console.log(
        `  ${checkOnly ? '·' : '✓'} ${captureLocale}/${
          shot.snapshot
        }.png → ${rel(dest)}`,
      );
      if (!checkOnly) {
        mkdirSync(dirname(dest), {recursive: true});
        copyFileSync(src, dest);
        copied += 1;
      }
    }
  }

  if (checkOnly) {
    console.log(
      `\n[check] ${missing} missing. Run without --check to copy into ${RAW_DIR}/${platform}/, then: ${frameHint}`,
    );
  } else {
    console.log(
      `\nDone. ${copied} copied, ${missing} missing. Next: ${frameHint}`,
    );
  }
}

main();
