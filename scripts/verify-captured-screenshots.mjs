#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI check script; stdout is its UI */
/**
 * Fail the capture job when fastlane `snapshot` did not produce every shot.
 *
 * The UI test (ios/KirokuUITests/ScreenshotTests.swift) deliberately does not
 * assert: a step that cannot reach its screen records a `[capture-miss]` and
 * moves on, so one broken selector neither hides the other five nor publishes
 * the wrong screen under the right filename. That makes the test run green even
 * when it captured nothing, which is exactly the silent failure that let a
 * broken pipeline sit unnoticed for months (the workflow's artifact upload also
 * only warns on an empty match).
 *
 * This is the gate instead: it looks at the PNGs that actually landed on disk
 * and compares them against the shot manifest the framing pipeline will consume
 * (scripts/store-screenshots.config.mjs), so capture and framing cannot drift.
 *
 * The Apple Watch capture is part of the gate too: the `watch` job of
 * screenshots.yml drops a single raw watch screenshot at <from>/watch/watch.png
 * (see the watch shot in the manifest). Because the phone and watch captures
 * run as separate CI jobs, each job scopes the check with --require; the
 * default (`all`) is for a local run over both downloaded artifacts.
 *
 * Usage:
 *   node scripts/verify-captured-screenshots.mjs
 *   node scripts/verify-captured-screenshots.mjs --from fastlane/screenshots/ios
 *   node scripts/verify-captured-screenshots.mjs --min-bytes 20000
 *   node scripts/verify-captured-screenshots.mjs --require phone   # phone job
 *   node scripts/verify-captured-screenshots.mjs --require watch   # watch job
 */

import {existsSync, readdirSync, statSync} from 'fs';
import {dirname, isAbsolute, join} from 'path';
import {fileURLToPath} from 'url';
// eslint-disable-next-line import/extensions -- Node ESM requires the explicit extension
import config from './store-screenshots.config.mjs';

const {shots, captureLocales} = config;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(scriptDir, '..');

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

const fromArg = flag('from');
function resolveFromDir(value) {
  if (typeof value !== 'string') {
    return join(ROOT, 'fastlane', 'screenshots', 'ios');
  }
  return isAbsolute(value) ? value : join(ROOT, value);
}
const fromDir = resolveFromDir(fromArg);

// A capture that failed mid-render still writes a file, so size is part of the
// check. A 1320x2868 screenshot of a real screen is hundreds of KB; anything
// this small is a blank or partial frame.
const minBytes = Number(flag('min-bytes') ?? 20000);

// The watch screen is tiny (~410x502) and mostly dark, so a legitimate PNG can
// be well under the phone floor; a solid-black frame is still only a few KB.
const WATCH_MIN_BYTES = 10000;

// Which captures to require: the phone matrix and the watch capture come from
// separate CI jobs, so each passes its own scope; `all` is the local default.
const requiredScope = String(flag('require') ?? 'all');
if (!['phone', 'watch', 'all'].includes(requiredScope)) {
  console.error(`FAIL unknown --require value "${requiredScope}" (phone|watch|all)`);
  process.exit(1);
}

// Every shot the UI test emits. `07_Settings` is captured but intentionally not
// mapped into the store listing, so it is not in the manifest; require only
// what the framing pipeline actually consumes.
const expected = shots.filter(s => s.snapshot).map(s => s.snapshot);

// The watch capture the `watch` CI job writes: <from>/watch/<raw>, one file
// total (ingest fans it out to every locale; the watch UI follows the watch
// simulator's locale, not the app's in-app switcher).
const watchShots = shots.filter(s => (s.kind ?? 'phone') === 'watch');

const captureLocaleDirs = new Set(Object.values(captureLocales));

if (!existsSync(fromDir)) {
  console.error(`FAIL no capture directory at ${fromDir}`);
  console.error('No capture job produced anything at all.');
  process.exit(1);
}

const problems = [];
let checked = 0;

function verifyPhone() {
  const localeDirs = readdirSync(fromDir, {withFileTypes: true})
    .filter(d => d.isDirectory() && captureLocaleDirs.has(d.name))
    .map(d => d.name)
    .sort();

  if (localeDirs.length === 0) {
    console.error(`FAIL no locale folders under ${fromDir}`);
    console.error(
      `Expected one of ${[...captureLocaleDirs].join(', ')}; found ${JSON.stringify(
        readdirSync(fromDir),
      )}.`,
    );
    process.exit(1);
  }

  for (const locale of localeDirs) {
    const localeDir = join(fromDir, locale);
    const deviceDirs = readdirSync(localeDir, {withFileTypes: true})
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();

    if (deviceDirs.length === 0) {
      problems.push(`${locale}: no device folders (nothing was captured)`);
      continue;
    }

    for (const device of deviceDirs) {
      for (const name of expected) {
        const file = join(localeDir, device, `${name}.png`);
        checked += 1;
        if (!existsSync(file)) {
          problems.push(`${locale}/${device}: missing ${name}.png`);
          continue;
        }
        const {size} = statSync(file);
        if (size < minBytes) {
          problems.push(
            `${locale}/${device}: ${name}.png is only ${size} bytes (< ${minBytes})`,
          );
        }
      }
    }
    console.log(`${locale}: ${deviceDirs.join(', ')}`);
  }
  console.log(`Phone: checked ${localeDirs.length} locale(s).`);
}

function verifyWatch() {
  for (const shot of watchShots) {
    const file = join(fromDir, 'watch', shot.raw);
    checked += 1;
    if (!existsSync(file)) {
      problems.push(
        `watch: missing ${shot.raw} (expected at ${join(fromDir, 'watch', shot.raw)})`,
      );
      continue;
    }
    const {size} = statSync(file);
    if (size < WATCH_MIN_BYTES) {
      problems.push(
        `watch: ${shot.raw} is only ${size} bytes (< ${WATCH_MIN_BYTES}); likely a blank frame`,
      );
      continue;
    }
    console.log(`watch: ${shot.raw} (${size} bytes)`);
  }
}

if (requiredScope === 'phone' || requiredScope === 'all') {
  verifyPhone();
}
if (requiredScope === 'watch' || requiredScope === 'all') {
  verifyWatch();
}

console.log(`\nChecked ${checked} expected file(s) (--require ${requiredScope}).`);

if (problems.length > 0) {
  console.error(`\nFAIL ${problems.length} problem(s):`);
  for (const p of problems) {
    console.error(`  - ${p}`);
  }
  console.error(
    '\nPhone misses: grep the fastlane log for "[capture-miss]". Watch misses: read the watch job\'s "Bridge token and capture" step and the watch-diagnostics artifact.',
  );
  process.exit(1);
}

console.log('OK every expected screenshot was captured.');
