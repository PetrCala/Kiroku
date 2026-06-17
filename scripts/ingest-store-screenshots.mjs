#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI build script; stdout is its UI */
/**
 * Ingest fastlane `snapshot` captures into the framing pipeline's raw/ tree.
 *
 * Bridges the two halves of the store-screenshot pipeline: fastlane `snapshot`
 * (the screenshots.yml CI workflow, or a local run) writes captures named after
 * the UI test's snapshot() calls, while frame-app-store-screenshots.mjs expects
 * differently-named, locale-remapped inputs. This mapper copies + renames the
 * captures into place, driven by the SAME manifest the framer uses
 * (store-screenshots.config.mjs), so the two halves can never silently drift.
 *
 * Capture layout (input):
 *   <from>/<captureLocale>/<device>/<snapshot>.png
 *      e.g. en-US/iPhone 17 Pro Max/01_Home.png
 * Raw layout (output, consumed by the framer):
 *   fastlane/store-screenshots/raw/<locale>/<raw>
 *      e.g. raw/en-US/01-home.png
 *
 * Mapping comes from config.shots[].{snapshot,raw}, config.captureLocales
 * (en-US→en-US, cs→cs-CZ) and config.captureSourceDevice (the 6.9" iPhone the
 * framer derives every size from — the iPad capture is not consumed). Captures
 * with no manifest entry (e.g. 05_Settings) are reported and skipped. Bytes are
 * copied verbatim (Apple Guideline 2.3.3 — never alter the real capture).
 *
 * Usage:
 *   node scripts/ingest-store-screenshots.mjs                 # from fastlane/screenshots/ios
 *   node scripts/ingest-store-screenshots.mjs --from ~/Downloads/ios-screenshots-<sha>
 *   node scripts/ingest-store-screenshots.mjs --locale cs     # one locale
 *   node scripts/ingest-store-screenshots.mjs --device "iPad Pro 13-inch (M5)"  # override source device folder
 *   node scripts/ingest-store-screenshots.mjs --check         # dry-run report, copy nothing
 *
 * Config: scripts/store-screenshots.config.mjs   (shared with the framer)
 * Next step after a real run: npm run frame-screenshots
 */

import {copyFileSync, existsSync, mkdirSync, readdirSync} from 'fs';
import {dirname, isAbsolute, join} from 'path';
import {fileURLToPath} from 'url';
// eslint-disable-next-line import/extensions -- Node ESM requires the explicit extension
import config from './store-screenshots.config.mjs';

const {RAW_DIR, locales, shots, captureLocales, captureSourceDevice} = config;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(scriptDir, '..');

// ─── CLI args (same convention as frame-app-store-screenshots.mjs) ────────────
const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] ?? true : undefined;
};
const fromArg = flag('from');
const onlyLocale = flag('locale');
const deviceOverride =
  typeof flag('device') === 'string' ? flag('device') : undefined;
const checkOnly = args.includes('--check');

const DEFAULT_FROM = join(ROOT, 'fastlane', 'screenshots', 'ios');
function resolveFromDir(value) {
  if (typeof value !== 'string') {
    return DEFAULT_FROM;
  }
  return isAbsolute(value) ? value : join(ROOT, value);
}
const fromDir = resolveFromDir(fromArg);

const rel = p => (p.startsWith(`${ROOT}/`) ? p.slice(ROOT.length + 1) : p);

// ─── Source resolution ────────────────────────────────────────────────────────
/** Accept either the capture dir itself (…/ios with <locale>/ as direct
 *  children) or a downloaded-artifact dir that still nests
 *  fastlane/screenshots/ios/. */
function resolveSourceRoot(base) {
  const candidates = [base, join(base, 'fastlane', 'screenshots', 'ios')];
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

/** The device subfolder to read for a given locale's capture dir. */
function resolveDeviceDir(localeSrcDir, locale) {
  if (deviceOverride) {
    return join(localeSrcDir, deviceOverride);
  }
  const preferred = join(localeSrcDir, captureSourceDevice);
  if (existsSync(preferred)) {
    return preferred;
  }
  const subdirs = existsSync(localeSrcDir)
    ? readdirSync(localeSrcDir, {withFileTypes: true})
        .filter(d => d.isDirectory())
        .map(d => d.name)
    : [];
  const iphones = subdirs.filter(n => /iphone/i.test(n));
  if (iphones.length === 1) {
    console.warn(
      `  ! ${locale}: "${captureSourceDevice}" not found, using "${iphones[0]}"`,
    );
    return join(localeSrcDir, iphones[0]);
  }
  if (iphones.length > 1) {
    console.warn(
      `  ! ${locale}: "${captureSourceDevice}" not found; multiple iPhone folders ${JSON.stringify(
        iphones,
      )}. Pass --device "<name>". Skipping.`,
    );
    return null;
  }
  console.warn(
    `  ✗ ${locale}: no iPhone capture folder under ${rel(
      localeSrcDir,
    )} (found ${JSON.stringify(subdirs)})`,
  );
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const sourceRoot = resolveSourceRoot(fromDir);
  if (!existsSync(sourceRoot)) {
    console.error(
      `No capture source at ${rel(
        sourceRoot,
      )}. Capture first (see the store-screenshots skill) or pass --from <dir>.`,
    );
    process.exit(1);
  }
  console.log(
    `${checkOnly ? '[check] ' : ''}Ingesting captures from ${rel(sourceRoot)}\n`,
  );

  const mapped = new Set(
    shots.filter(s => s.snapshot).map(s => `${s.snapshot}.png`),
  );
  const targetLocales = locales.filter(l => !onlyLocale || l === onlyLocale);
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
    const deviceDir = resolveDeviceDir(localeSrcDir, locale);
    if (!deviceDir || !existsSync(deviceDir)) {
      missing += shots.length;
      continue;
    }

    // Surface captures present in the source that the manifest doesn't map
    // (e.g. 05_Settings) so a skipped screen is visible, not silent.
    for (const f of readdirSync(deviceDir)) {
      if (f.endsWith('.png') && !mapped.has(f)) {
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
      const src = join(deviceDir, `${shot.snapshot}.png`);
      const dest = join(ROOT, RAW_DIR, locale, shot.raw);
      if (!existsSync(src)) {
        console.warn(`  ✗ ${locale}: missing ${rel(src)}`);
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
      `\n[check] ${missing} missing. Run without --check to copy into ${RAW_DIR}/, then: npm run frame-screenshots`,
    );
  } else {
    console.log(
      `\nDone. ${copied} copied, ${missing} missing. Next: npm run frame-screenshots`,
    );
  }
}

main();
